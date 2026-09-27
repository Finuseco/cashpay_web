import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLoanHistory } from '@/lib/actions/loan.actions';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const loans = await getLoanHistory(user.id);

    return NextResponse.json({
      success: true,
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
