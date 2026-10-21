import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createLoanApplication } from '@/lib/actions/loan.actions';

const ALLOWED_LOAN_CURRENCIES = ['CDF', 'USD', 'EUR'] as const;
const ALLOWED_FREQUENCIES = ['weekly', 'monthly', 'quarterly'] as const;

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const amount = Number(body.amount);
    const currency = String(body.currency || '').trim().toUpperCase();
    const durationMonths = Number(body.durationMonths);

    const repaymentFrequency =
      body.repaymentFrequency !== undefined
        ? String(body.repaymentFrequency).trim().toLowerCase()
        : undefined;

    const installmentCount =
      body.installmentCount !== undefined
        ? Number(body.installmentCount)
        : undefined;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Montant de prêt invalide.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_LOAN_CURRENCIES.includes(currency as typeof ALLOWED_LOAN_CURRENCIES[number])) {
      return NextResponse.json(
        {
          success: false,
          error: 'Devise non autorisée pour LoanMe.',
          allowedCurrencies: [...ALLOWED_LOAN_CURRENCIES],
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(durationMonths) || durationMonths <= 0) {
      return NextResponse.json(
        { success: false, error: 'Durée du prêt invalide.' },
        { status: 400 }
      );
    }

    if (
      repaymentFrequency !== undefined &&
      !ALLOWED_FREQUENCIES.includes(
        repaymentFrequency as typeof ALLOWED_FREQUENCIES[number]
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Fréquence de remboursement invalide.' },
        { status: 400 }
      );
    }

    if (
      installmentCount !== undefined &&
      (!Number.isInteger(installmentCount) || installmentCount <= 0)
    ) {
      return NextResponse.json(
        { success: false, error: 'Nombre d’échéances invalide.' },
        { status: 400 }
      );
    }

    const result = await createLoanApplication({
      user,
      amount,
      currency,
      interestRate: 0,
      durationMonths,
      purpose: '',
      repaymentFrequency,
      installmentCount,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error: any) {
    console.error('Loan request API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de demander le prêt.',
      },
      { status: 500 }
    );
  }
}
