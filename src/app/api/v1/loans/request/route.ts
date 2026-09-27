import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createLoanApplication } from '@/lib/actions/loan.actions';

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
    const currency = String(body.currency || '').toUpperCase();
    const durationMonths = Number(body.durationMonths);

    const repaymentFrequency =
      body.repaymentFrequency !== undefined
        ? String(body.repaymentFrequency)
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

    if (!currency) {
      return NextResponse.json(
        { success: false, error: 'Devise requise.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(durationMonths) || durationMonths <= 0) {
      return NextResponse.json(
        { success: false, error: 'Durée du prêt invalide.' },
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

    return NextResponse.json(
      result,
      { status: result.success ? 200 : 400 }
    );
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
