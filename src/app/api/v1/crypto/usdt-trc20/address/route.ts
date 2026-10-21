import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

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

    const existing = await db.query(
      `SELECT address
       FROM user_crypto_addresses
       WHERE user_id = $1
         AND currency_code = 'USDT_TRC20'
       LIMIT 1`,
      [user.id],
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({
        success: true,
        currency: 'USDT',
        network: 'TRC20',
        address: existing.rows[0].address,
        existing: true,
      });
    }

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
  } catch (error) {
    console.error('[USDT_TRC20_ADDRESS]', error);
    return NextResponse.json(
      { success: false, error: 'ADDRESS_CREATION_FAILED' },
      { status: 500 },
    );
  }
}
