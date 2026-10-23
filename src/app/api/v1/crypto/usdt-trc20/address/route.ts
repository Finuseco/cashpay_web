import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { ensureUserUsdtAddress } from '@/services/usdt';
import { UsdtNotConfiguredError } from '@/services/tron';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await getAuthenticatedUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    // Retourne l'adresse existante, ou en crée une vraie (dérivée du
    // portefeuille HD) puis l'attribue à l'utilisateur.
    const { address, existing } = await ensureUserUsdtAddress(Number(user.id));

    return NextResponse.json({
      success: true,
      currency: 'USDT',
      network: 'TRC20',
      address,
      existing,
    });
  } catch (error) {
    if (error instanceof UsdtNotConfiguredError) {
      return NextResponse.json(
        {
          success: false,
          currency: 'USDT',
          network: 'TRC20',
          error: 'SECURE_KEY_CUSTODY_NOT_CONFIGURED',
          message: 'La création d’adresse est suspendue jusqu’à la configuration de la conservation sécurisée des clés.',
        },
        { status: 503 },
      );
    }

    console.error('[USDT_TRC20_ADDRESS]', error);
    return NextResponse.json(
      { success: false, error: 'ADDRESS_CREATION_FAILED' },
      { status: 500 },
    );
  }
}
