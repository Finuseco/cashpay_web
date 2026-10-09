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
    const plan = params.get('plan')?.trim().toLowerCase();

    if (plan !== 'promo' && plan !== 'normal') {
      return NextResponse.json(
        { success: false, error: 'Formule invalide. Utilisez promo ou normal.' },
        { status: 400 }
      );
    }

    const code = plan === 'promo'
      ? 'AGENT_SUB_PROMO'
      : 'AGENT_SUB_NORMAL';

    const fee = await calculateTransactionFee(
      1,
      'USD',
      code,
      user.country
    );

    if (fee <= 0) {
      return NextResponse.json(
        { success: false, error: 'Le tarif de cet abonnement n’est pas configuré pour votre pays.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      plan,
      currency: 'USD',
      code,
      fee
    });
  } catch (error) {
    console.error('[AGENT SUBSCRIPTION FEES]', error);

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération du tarif de l’abonnement.' },
      { status: 500 }
    );
  }
}
