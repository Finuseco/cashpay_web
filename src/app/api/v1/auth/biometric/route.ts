import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, createPublicKey, verify as verifySignature } from 'crypto';
import { db } from '@/lib/db';
import { generateToken, verifyToken } from '@/lib/jwt';

export const runtime = 'nodejs';

const COOKIE_NAME = 'cashpay-token';
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

function response(message: string, status = 200, data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: status < 400, message, ...data }, { status });
}

function newChallenge() {
  return randomBytes(32).toString('base64url');
}

function validText(value: unknown, max = 4096): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function readPublicKey(value: string) {
  if (value.includes('BEGIN PUBLIC KEY')) {
    return createPublicKey(value);
  }

  return createPublicKey({
    key: Buffer.from(value, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

function checkSignature(publicKey: string, challenge: string, signature: string) {
  try {
    return verifySignature(
      'sha256',
      Buffer.from(challenge, 'utf8'),
      readPublicKey(publicKey),
      Buffer.from(signature, 'base64')
    );
  } catch {
    return false;
  }
}

async function authenticatedUserId(): Promise<number | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = verifyToken(token);
    const id = Number(payload?.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action;

    // Enregistrement d'une nouvelle clé publique.
    if (action === 'register') {
      const userId = await authenticatedUserId();
      if (!userId) return response('Session invalide. Reconnectez-vous.', 401);

      const { credentialId, publicKey, deviceName } = body;

      if (!validText(credentialId, 512) || !validText(publicKey, 4096)) {
        return response('Identifiant ou clé publique invalide.', 400);
      }

      let normalizedKey: string;
      try {
        normalizedKey = readPublicKey(publicKey).export({
          type: 'spki',
          format: 'pem',
        }).toString();
      } catch {
        return response('La clé publique est invalide.', 400);
      }

      const challenge = newChallenge();

      try {
        await db.query(
          `INSERT INTO biometric_credentials
            (user_id, credential_id, public_key, device_name,
             is_active, challenge, challenge_expires_at)
           VALUES ($1, $2, $3, $4, FALSE, $5, NOW() + INTERVAL '2 minutes')`,
          [
            String(userId),
            credentialId,
            normalizedKey,
            typeof deviceName === 'string' ? deviceName.slice(0, 150) : null,
            challenge,
          ]
        );
      } catch (error: any) {
        if (error?.code === '23505') {
          return response('Cet authentifiant existe déjà.', 409);
        }
        throw error;
      }

      return response('Défi créé. Signez-le avec la clé privée de cet appareil.', 200, {
        credentialId,
        challenge,
        expiresInSeconds: 120,
        nextAction: 'confirm-registration',
      });
    }

    // Confirmation de possession de la clé privée.
    if (action === 'confirm-registration') {
      const userId = await authenticatedUserId();
      if (!userId) return response('Session invalide. Reconnectez-vous.', 401);

      const { credentialId, signature } = body;

      if (!validText(credentialId, 512) || !validText(signature, 4096)) {
        return response('Paramètres invalides.', 400);
      }

      const result = await db.query(
        `SELECT public_key, challenge
           FROM biometric_credentials
          WHERE user_id = $1 AND credential_id = $2
            AND is_active = FALSE
            AND challenge IS NOT NULL
            AND challenge_expires_at > NOW()
          LIMIT 1`,
        [String(userId), credentialId]
      );

      if (!result.rows.length) {
        return response('Défi expiré ou authentifiant introuvable.', 400);
      }

      const item = result.rows[0];

      if (!checkSignature(item.public_key, item.challenge, signature)) {
        return response('Signature biométrique invalide.', 401);
      }

      const updated = await db.query(
        `UPDATE biometric_credentials
            SET is_active = TRUE, challenge = NULL,
                challenge_expires_at = NULL, last_used_at = NOW()
          WHERE user_id = $1 AND credential_id = $2
            AND is_active = FALSE AND challenge = $3
          RETURNING id`,
        [String(userId), credentialId, item.challenge]
      );

      if (!updated.rows.length) {
        return response('Le défi a déjà été utilisé. Recommencez.', 409);
      }

      return response('Authentifiant biométrique enregistré.', 200);
    }

    // Demande de défi pour une connexion sans session.
    if (action === 'challenge') {
      const { credentialId } = body;

      if (!validText(credentialId, 512)) {
        return response('Identifiant biométrique requis.', 400);
      }

      const challenge = newChallenge();

      const result = await db.query(
        `UPDATE biometric_credentials
            SET challenge = $1,
                challenge_expires_at = NOW() + INTERVAL '2 minutes'
          WHERE credential_id = $2 AND is_active = TRUE
          RETURNING credential_id`,
        [challenge, credentialId]
      );

      if (!result.rows.length) {
        return response('Authentifiant introuvable ou désactivé.', 404);
      }

      return response('Défi de connexion créé.', 200, {
        credentialId,
        challenge,
        expiresInSeconds: 120,
      });
    }

    // Vérification du défi et ouverture de session CashPay All.
    if (action === 'verify') {
      const { credentialId, signature } = body;

      if (!validText(credentialId, 512) || !validText(signature, 4096)) {
        return response('Paramètres invalides.', 400);
      }

      const result = await db.query(
        `SELECT id, user_id, public_key, challenge
           FROM biometric_credentials
          WHERE credential_id = $1 AND is_active = TRUE
            AND challenge IS NOT NULL
            AND challenge_expires_at > NOW()
          LIMIT 1`,
        [credentialId]
      );

      if (!result.rows.length) {
        return response('Défi expiré ou authentifiant introuvable.', 401);
      }

      const item = result.rows[0];

      if (!checkSignature(item.public_key, item.challenge, signature)) {
        return response('Signature invalide.', 401);
      }

      // Consommer le défi une seule fois pour empêcher sa réutilisation.
      const consumed = await db.query(
        `UPDATE biometric_credentials
            SET challenge = NULL, challenge_expires_at = NULL,
                last_used_at = NOW(), sign_count = sign_count + 1
          WHERE id = $1 AND challenge = $2
            AND challenge_expires_at > NOW()
          RETURNING user_id`,
        [item.id, item.challenge]
      );

      if (!consumed.rows.length) {
        return response('Défi déjà utilisé ou expiré.', 401);
      }

      const userId = Number(consumed.rows[0].user_id);
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return response('Identifiant de compte invalide.', 500);
      }

      const users = await db.query(
        'SELECT * FROM users WHERE id = $1::integer LIMIT 1',
        [userId]
      );

      if (!users.rows.length) {
        return response('Compte CashPay All introuvable.', 404);
      }

      const token = generateToken(users.rows[0]);

      cookies().set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });

      return response('Connexion biométrique réussie.', 200);
    }

    // Révocation d'un appareil depuis une session authentifiée.
    if (action === 'revoke') {
      const userId = await authenticatedUserId();
      if (!userId) return response('Session invalide. Reconnectez-vous.', 401);

      const { credentialId } = body;
      if (!validText(credentialId, 512)) {
        return response('Identifiant biométrique requis.', 400);
      }

      const result = await db.query(
        `UPDATE biometric_credentials
            SET is_active = FALSE, revoked_at = NOW(),
                challenge = NULL, challenge_expires_at = NULL
          WHERE user_id = $1 AND credential_id = $2 AND is_active = TRUE
          RETURNING id`,
        [String(userId), credentialId]
      );

      if (!result.rows.length) {
        return response('Authentifiant actif introuvable.', 404);
      }

      return response('Authentifiant biométrique désactivé.');
    }

    return response(
      'Action invalide. Actions disponibles : register, confirm-registration, challenge, verify, revoke.',
      400
    );
  } catch (error) {
    console.error('[biometric API]', error);
    return response('Erreur interne du service biométrique.', 500);
  }
}
