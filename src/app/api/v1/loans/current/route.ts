import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLoanForUser } from '@/lib/actions/loan.actions';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const loan = await getLoanForUser(user.id);

    return NextResponse.json({
      success: true,
      loan,
    });
  } catch (error: any) {
    console.error('Current loan API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer le prêt actuel.',
      },
      { status: 500 }
    );
  }
}
