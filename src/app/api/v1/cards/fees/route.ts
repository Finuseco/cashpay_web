import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const params = new URL(request.url).searchParams;
    const type = params.get('type')?.trim().toLowerCase();
    const currency = params.get('currency')?.trim().toUpperCase();

    if (type !== 'virtuelle' && type !== 'physique') {
      return NextResponse.json(
        { success: false, error: 'Type de carte invalide.' },
        { status: 400 }
      );
    }

    if (currency !== 'USD' && currency !== 'EUR') {
      return NextResponse.json(
        { success: false, error: 'Les cartes FYATU sont disponibles en USD ou EUR.' },
        { status: 400 }
      );
    }

    const suffix = type === 'virtuelle' ? 'V' : 'P';
    const code = `BUY_CARDS_${currency}_${suffix}_FEE`;

    const fee = await calculateTransactionFee(
      1,
      currency,
      code,
      null
    );

    return NextResponse.json({
      success: true,
      type,
      currency,
      code,
      fee
    });
  } catch (error) {
    console.error('[CARD FEES]', error);

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération du tarif de la carte.' },
      { status: 500 }
    );
  }
}
