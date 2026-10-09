import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

const PROVIDERS = ['western_union', 'moneygram', 'ria'] as const;
const CURRENCIES = ['USD', 'EUR', 'CDF'] as const;

function normalizeProvider(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCurrency(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser();

    if (!authenticatedUser?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentification requise.'
        },
        { status: 401 }
      );
    }

    const userId = Number(authenticatedUser.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session utilisateur invalide.'
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const provider = normalizeProvider(body.provider);
    const trackingNumber =
      typeof body.trackingNumber === 'string'
        ? body.trackingNumber.trim()
        : '';

    const expectedAmount = Number(body.expectedAmount);
    const expectedCurrency = normalizeCurrency(body.expectedCurrency);
    const senderCountry =
      typeof body.senderCountry === 'string'
        ? body.senderCountry.trim()
        : '';

    const receiveInCurrency = normalizeCurrency(body.receiveInCurrency);

    if (!PROVIDERS.includes(provider as typeof PROVIDERS[number])) {
      return NextResponse.json(
        {
          success: false,
          error: 'Fournisseur de transfert invalide.'
        },
        { status: 400 }
      );
    }

    if (!trackingNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'La référence du transfert est obligatoire.'
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le montant du transfert est invalide.'
        },
        { status: 400 }
      );
    }

    if (!CURRENCIES.includes(expectedCurrency as typeof CURRENCIES[number])) {
      return NextResponse.json(
        {
          success: false,
          error: 'La devise du transfert est invalide.'
        },
        { status: 400 }
      );
    }

    if (!CURRENCIES.includes(receiveInCurrency as typeof CURRENCIES[number])) {
      return NextResponse.json(
        {
          success: false,
          error: 'La devise de réception est invalide.'
        },
        { status: 400 }
      );
    }

    if (!senderCountry) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le pays d’origine du transfert est obligatoire.'
        },
        { status: 400 }
      );
    }

    /*
     * L'identité du demandeur vient exclusivement de la session.
     * Android ne peut pas fournir un userId pour choisir un autre compte.
     */

    const { rows: userRows } = await db.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (userRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Utilisateur introuvable.'
        },
        { status: 404 }
      );
    }

    /*
     * On associe la pièce d'identité déjà enregistrée au compte.
     * Elle servira au traitement/contrôle du back-office.
     */
    const { rows: documentRows } = await db.query(
      `
      SELECT id
      FROM user_documents
      WHERE user_id = $1
      ORDER BY id ASC
      LIMIT 1
      `,
      [userId]
    );

    const userDocumentId = documentRows[0]?.id ?? null;

    /*
     * Empêche une duplication d'une même réclamation active
     * pour le même utilisateur, fournisseur et numéro.
     *
     * Une ancienne réclamation rejetée peut être soumise à nouveau.
     */
    const { rows: existingRows } = await db.query(
      `
      SELECT id, status
      FROM international_transfer_claims
      WHERE user_id = $1
        AND provider = $2
        AND tracking_number = $3
        AND status <> 'rejected'
      ORDER BY id DESC
      LIMIT 1
      `,
      [userId, provider, trackingNumber]
    );

    if (existingRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cette réclamation existe déjà.',
          claim: {
            id: existingRows[0].id,
            status: existingRows[0].status
          }
        },
        { status: 409 }
      );
    }

    const { rows } = await db.query(
      `
      INSERT INTO international_transfer_claims (
        user_id,
        provider,
        tracking_number,
        expected_amount,
        expected_currency,
        sender_country,
        receive_in_currency,
        status,
        user_document_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
      RETURNING
        id,
        user_id,
        provider,
        tracking_number,
        expected_amount,
        expected_currency,
        sender_country,
        receive_in_currency,
        status,
        user_document_id,
        created_at,
        updated_at
      `,
      [
        userId,
        provider,
        trackingNumber,
        expectedAmount,
        expectedCurrency,
        senderCountry,
        receiveInCurrency,
        userDocumentId
      ]
    );

    const claim = rows[0];

    return NextResponse.json(
      {
        success: true,
        message: 'Votre réclamation a été soumise avec succès.',
        claim: {
          id: claim.id,
          provider: claim.provider,
          trackingNumber: claim.tracking_number,
          expectedAmount: Number(claim.expected_amount),
          expectedCurrency: claim.expected_currency,
          senderCountry: claim.sender_country,
          receiveInCurrency: claim.receive_in_currency,
          status: claim.status,
          userDocumentId: claim.user_document_id,
          createdAt: claim.created_at,
          updatedAt: claim.updated_at
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[International Claims] POST error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de soumettre la réclamation.'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const authenticatedUser = await getAuthenticatedUser();

    if (!authenticatedUser?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentification requise.'
        },
        { status: 401 }
      );
    }

    const userId = Number(authenticatedUser.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session utilisateur invalide.'
        },
        { status: 401 }
      );
    }

    const { rows } = await db.query(
      `
      SELECT
        id,
        provider,
        tracking_number,
        expected_amount,
        expected_currency,
        sender_country,
        receive_in_currency,
        status,
        user_document_id,
        created_at,
        updated_at
      FROM international_transfer_claims
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [userId]
    );

    return NextResponse.json({
      success: true,
      count: rows.length,
      claims: rows.map((claim) => ({
        id: claim.id,
        provider: claim.provider,
        trackingNumber: claim.tracking_number,
        expectedAmount: Number(claim.expected_amount),
        expectedCurrency: claim.expected_currency,
        senderCountry: claim.sender_country,
        receiveInCurrency: claim.receive_in_currency,
        status: claim.status,
        userDocumentId: claim.user_document_id,
        createdAt: claim.created_at,
        updatedAt: claim.updated_at
      }))
    });
  } catch (error) {
    console.error('[International Claims] GET error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de récupérer les réclamations.'
      },
      { status: 500 }
    );
  }
}
