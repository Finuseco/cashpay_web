import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { repayLoanInstallment } from '@/lib/actions/loan.actions';

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
    const installmentId = Number(body.installmentId);

    if (!Number.isInteger(loanId) || loanId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Identifiant du prêt invalide.' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(installmentId) || installmentId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Identifiant de l’échéance invalide.' },
        { status: 400 }
      );
    }

    const result = await repayLoanInstallment(
      user.id,
      loanId,
      installmentId
    );

    return NextResponse.json(
      result,
      { status: result.success ? 200 : 400 }
    );
  } catch (error: any) {
    console.error('Loan installment repayment API error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Impossible de rembourser cette échéance.',
      },
      { status: 500 }
    );
  }
}
