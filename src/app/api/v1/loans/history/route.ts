import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLoanHistory } from '@/lib/actions/loan.actions';

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
      request.nextUrl.searchParams.get('currency') || 'ALL'
    ).trim().toUpperCase();

    if (
      requestedCurrency !== 'ALL' &&
      !ALLOWED_LOAN_CURRENCIES.includes(
        requestedCurrency as typeof ALLOWED_LOAN_CURRENCIES[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Filtre de devise invalide.',
          allowedCurrencies: ['ALL', ...ALLOWED_LOAN_CURRENCIES],
        },
        { status: 400 }
      );
    }

    const allLoans = await getLoanHistory(user.id);

    const loans =
      requestedCurrency === 'ALL'
        ? allLoans
        : allLoans.filter(
            (loan: any) =>
              String(loan.currency || '').trim().toUpperCase() === requestedCurrency
          );

    return NextResponse.json({
      success: true,
      currency: requestedCurrency,
      allowedCurrencies: ['ALL', ...ALLOWED_LOAN_CURRENCIES],
      loans,
    });
  } catch (error: any) {
    console.error('Loan history API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer l’historique des prêts.',
      },
      { status: 500 }
    );
  }
}
