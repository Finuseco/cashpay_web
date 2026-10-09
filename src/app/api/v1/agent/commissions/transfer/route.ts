import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { executeCommissionClaim } from '@/lib/ussd/ussd.actions';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentification requise.',
        },
        { status: 401 }
      );
    }

    if (String((user as any).role || '').toLowerCase() !== 'agent') {
      return NextResponse.json(
        {
          success: false,
          error: 'Un compte Agent est requis.',
        },
        { status: 403 }
      );
    }

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Corps de requête JSON invalide.',
        },
        { status: 400 }
      );
    }

    const amount = Number(body?.amount);
    const currency = String(body?.currency || '')
      .trim()
      .toUpperCase();
    const pin = String(body?.pin || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Montant invalide.',
        },
        { status: 400 }
      );
    }

    if (!currency) {
      return NextResponse.json(
        {
          success: false,
          error: 'Devise requise.',
        },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le PIN doit contenir exactement 4 chiffres.',
        },
        { status: 400 }
      );
    }

    const result = await executeCommissionClaim(
      user as any,
      amount,
      currency,
      pin
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            'Bascule des commissions impossible.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      operation: 'commission_claim',
      reference: result.reference || null,
      transactionId: result.transactionId || null,
      amount: result.amount,
      currency: result.currency,
      remainingCommission: result.remainingCommission,
      newMainBalance: result.newMainBalance,
      message:
        `Bascule de ${result.amount} ${result.currency} ` +
        'effectuée avec succès.',
    });
  } catch (error: any) {
    console.error('[Agent Commissions Transfer POST]', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Erreur interne lors de la bascule des commissions.',
      },
      { status: 500 }
    );
  }
}
