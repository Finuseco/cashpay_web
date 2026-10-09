import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    const { id } = await context.params;
    const claimId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session utilisateur invalide.'
        },
        { status: 401 }
      );
    }

    if (!Number.isInteger(claimId) || claimId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Identifiant de réclamation invalide.'
        },
        { status: 400 }
      );
    }

    /*
     * Le user_id est toujours imposé par la session.
     * Un utilisateur ne peut donc pas consulter la réclamation
     * d'un autre compte CashPay.
     */
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
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [claimId, userId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Réclamation introuvable.'
        },
        { status: 404 }
      );
    }

    const claim = rows[0];

    return NextResponse.json({
      success: true,
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
    });
  } catch (error) {
    console.error('[International Claims] GET detail error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de récupérer la réclamation.'
      },
      { status: 500 }
    );
  }
}
