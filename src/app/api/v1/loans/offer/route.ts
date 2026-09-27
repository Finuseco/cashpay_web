import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLoanOffer } from '@/lib/actions/loan.actions';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const currency = String(
      searchParams.get('currency') || 'USD'
    ).toUpperCase();

    const result = await getLoanOffer(user.id, currency);

    return NextResponse.json({
      success: true,
      offer: result,
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
