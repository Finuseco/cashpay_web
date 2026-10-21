import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLoanOffer } from '@/lib/actions/loan.actions';

const ALLOWED_LOAN_CURRENCIES = ['CDF', 'USD', 'EUR'] as const;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const requestedCurrency = String(
      request.nextUrl.searchParams.get('currency') || 'USD'
    ).trim().toUpperCase();

    if (!ALLOWED_LOAN_CURRENCIES.includes(requestedCurrency as typeof ALLOWED_LOAN_CURRENCIES[number])) {
      return NextResponse.json(
        {
          success: false,
          error: 'Devise non autorisée pour LoanMe.',
          allowedCurrencies: [...ALLOWED_LOAN_CURRENCIES],
        },
        { status: 400 }
      );
    }

    const offer = await getLoanOffer(user.id, requestedCurrency);

    return NextResponse.json({
      success: true,
      allowedCurrencies: [...ALLOWED_LOAN_CURRENCIES],
      offer,
    });
  } catch (error: any) {
    console.error('Loans offer API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer l’offre de prêt.',
      },
      { status: 500 }
    );
  }
}
