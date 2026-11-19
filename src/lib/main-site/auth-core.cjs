'use strict';

const crypto = require('node:crypto');

const AUDIENCE = 'main-admin';
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

class MainAuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'MainAuthError';
    this.status = status;
    this.code = code;
  }
}

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const isAdmin = user => user && user.role === 'Admin' && user.status === 'Active';
const safeEqual = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const publicUser = user => ({ id: Number(user.id), walletId: user.id_wallet, fullName: user.full_name || '', role: 'Admin' });
const denied = () => new MainAuthError(401, 'AUTH_REQUIRED', 'Authentification administrateur requise.');
const invalidChallenge = () => new MainAuthError(401, 'INVALID_CHALLENGE', 'La vérification a expiré. Recommencez la connexion.');
const outcome = result => { if (result.error) throw result.error; return result; };

function availableChannels(user) {
  let configured = user.notifications_channel;
  if (typeof configured === 'string') {
    try { configured = JSON.parse(configured); } catch { configured = []; }
  }
  const all = [...(user.email ? ['email'] : []), ...(user.phone ? ['sms', 'whatsapp'] : [])];
  const selected = Array.isArray(configured) ? all.filter(channel => configured.includes(channel)) : [];
  // Email and WhatsApp are supported by the existing login even when SMS is preferred.
  return [...new Set([...selected, ...all])];
}

function maskDestination(value, channel) {
  if (channel === 'email') {
    const [local, domain] = String(value).split('@');
    return domain ? `${local.slice(0, 1)}***@${domain}` : '***';
  }
  return `***${String(value).slice(-4)}`;
}

function createMainAuth({ store, deliverOtp, checkPin, now = () => new Date(), randomToken = newToken, randomOtp = () => String(crypto.randomInt(100000, 1000000)) }) {
  const challengeHash = token => {
    if (!validToken(token)) throw invalidChallenge();
    return digest(token);
  };

  async function lockedChallenge(token, action) {
    const hash = challengeHash(token);
    return outcome(await store.transaction(async tx => {
      const row = await tx.lockChallenge(hash);
      const at = now();
      if (!row || row.audience !== AUDIENCE || row.consumed_at || new Date(row.expires_at) <= at || !isAdmin(row.user)) {
        if (row) await tx.updateChallenge(row.id, { consumed_at: at });
        return { error: invalidChallenge() };
      }
      return action(tx, row, at);
    }));
  }

  return {
    async start({ walletId, channel, ip = 'unknown' }) {
      if (typeof walletId !== 'string' || !/^[A-Za-z0-9_-]{4,40}$/.test(walletId.trim())) {
        throw new MainAuthError(400, 'INVALID_WALLET', 'ID de portefeuille invalide.');
      }
      if (channel !== undefined && !['sms', 'email', 'whatsapp'].includes(channel)) {
        throw new MainAuthError(400, 'INVALID_CHANNEL', 'Canal de vérification invalide.');
      }
      const wallet = walletId.trim();
      const at = now();
      const token = randomToken();
      const otp = randomOtp();
      const prepared = outcome(await store.transaction(async tx => {
        const walletCount = await tx.incrementRate(digest(`main-auth:wallet:${wallet}`), at, RATE_WINDOW_MS);
        const ipCount = await tx.incrementRate(digest(`main-auth:ip:${String(ip).slice(0, 160)}`), at, RATE_WINDOW_MS);
        if (walletCount > 5 || ipCount > 20) {
          return { error: new MainAuthError(429, 'RATE_LIMITED', 'Trop de tentatives. Réessayez dans 15 minutes.') };
        }
        const user = await tx.findUserByWallet(wallet);
        // This deliberately reveals neither existence nor the user's role.
        if (!isAdmin(user)) return { error: new MainAuthError(401, 'LOGIN_UNAVAILABLE', 'Connexion indisponible pour cet identifiant.') };
        const channels = availableChannels(user);
        const selected = channel || (channels.includes('email') ? 'email' : channels[0]);
        if (!selected || !channels.includes(selected)) {
          return { error: new MainAuthError(400, 'CHANNEL_UNAVAILABLE', 'Ce canal de vérification est indisponible.') };
        }
        const expiresAt = new Date(at.getTime() + CHALLENGE_TTL_MS);
        await tx.invalidateChallenges(user.id, at);
        const id = randomToken();
        await tx.insertChallenge({ id, user_id: user.id, token_hash: digest(token), otp_hash: digest(`${token}:${otp}`), audience: AUDIENCE, channel: selected, expires_at: expiresAt });
        return { id, user, selected, channels, expiresAt };
      }));
      try {
        const delivered = await deliverOtp({ user: prepared.user, channel: prepared.selected, otp });
        if (delivered !== true) throw new Error('Delivery rejected');
      } catch {
        await store.revokeChallenge(prepared.id, now());
        throw new MainAuthError(503, 'DELIVERY_FAILED', 'Le code ne peut pas être envoyé. Réessayez plus tard.');
      }
      return {
        challengeToken: token,
        step: 'otp',
        channel: prepared.selected,
        availableChannels: prepared.channels,
        maskedDestination: maskDestination(prepared.selected === 'email' ? prepared.user.email : prepared.user.phone, prepared.selected),
        expiresAt: prepared.expiresAt.toISOString(),
      };
    },

    async verifyOtp(token, otp) {
      return lockedChallenge(token, async (tx, row, at) => {
        if (row.otp_verified_at) return { error: new MainAuthError(409, 'OTP_ALREADY_VERIFIED', 'Saisissez votre PIN pour terminer la connexion.') };
        if (row.otp_attempts >= MAX_ATTEMPTS) return { error: invalidChallenge() };
        const matches = typeof otp === 'string' && /^\d{6}$/.test(otp) && safeEqual(row.otp_hash, digest(`${token}:${otp}`));
        const attempts = row.otp_attempts + 1;
        await tx.updateChallenge(row.id, {
          otp_attempts: attempts,
          ...(matches ? { otp_verified_at: at } : attempts >= MAX_ATTEMPTS ? { consumed_at: at } : {}),
        });
        if (!matches) return { error: new MainAuthError(401, 'INVALID_OTP', 'Le code est invalide ou a expiré.') };
        return { step: 'pin', expiresAt: new Date(row.expires_at).toISOString() };
      });
    },

    async verifyPin(token, pin) {
      return lockedChallenge(token, async (tx, row, at) => {
        if (!row.otp_verified_at) return { error: new MainAuthError(401, 'OTP_REQUIRED', 'Vérifiez le code reçu avant de saisir votre PIN.') };
        if (row.pin_attempts >= MAX_ATTEMPTS) return { error: invalidChallenge() };
        const valid = typeof pin === 'string' && /^\d{4,8}$/.test(pin) && await checkPin(pin, row.user);
        const attempts = row.pin_attempts + 1;
        await tx.updateChallenge(row.id, { pin_attempts: attempts, ...(!valid && attempts >= MAX_ATTEMPTS ? { consumed_at: at } : {}) });
        if (!valid) return { error: new MainAuthError(401, 'INVALID_PIN', 'Le code PIN est incorrect.') };
        const sessionToken = randomToken();
        const expiresAt = new Date(at.getTime() + SESSION_TTL_MS);
        await tx.insertSession({ id: randomToken(), user_id: row.user.id, token_hash: digest(sessionToken), audience: AUDIENCE, expires_at: expiresAt });
        await tx.updateChallenge(row.id, { consumed_at: at });
        return { sessionToken, user: publicUser(row.user), expiresAt: expiresAt.toISOString() };
      });
    },

    async session(token) {
      if (!validToken(token)) throw denied();
      const row = await store.findSession(digest(token));
      if (!row || row.audience !== AUDIENCE || row.revoked_at || new Date(row.expires_at) <= now() || !isAdmin(row.user)) throw denied();
      return { user: publicUser(row.user), expiresAt: new Date(row.expires_at).toISOString() };
    },

    async logout(sessionToken, challengeToken) {
      if (validToken(sessionToken)) await store.revokeSession(digest(sessionToken), now());
      if (validToken(challengeToken)) await store.revokeChallengeByToken(digest(challengeToken), now());
    },
  };
}

module.exports = { createMainAuth, MainAuthError, AUDIENCE, CHALLENGE_TTL_MS, SESSION_TTL_MS, digest, safeEqual };
