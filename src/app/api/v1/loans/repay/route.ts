import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { repayLoan } from '@/lib/actions/loan.actions';

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
    const loanId = Number(body.loanId);
    const amount = Number(body.amount);

    if (!Number.isSafeInteger(loanId) || loanId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Identifiant du prêt invalide.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Montant de remboursement invalide.' },
        { status: 400 }
      );
    }

    const result = await repayLoan(user.id, loanId, amount);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error: any) {
    console.error('Loan repayment API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de rembourser le prêt.',
      },
      { status: 500 }
    );
  }
}
