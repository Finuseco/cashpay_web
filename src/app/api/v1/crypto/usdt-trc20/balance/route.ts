import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getTronUsdtBalance } from '@/services/tron';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    const result = await db.query(
      `SELECT address
       FROM user_crypto_addresses
       WHERE user_id = $1
         AND currency_code = 'USDT_TRC20'
       LIMIT 1`,
      [user.id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'USDT_ADDRESS_NOT_CONFIGURED',
          message: 'Aucune adresse USDT TRC-20 n’est encore attribuée à ce compte.',
        },
        { status: 404 },
      );
    }

    const address = result.rows[0].address;
    const balance = await getTronUsdtBalance(address);

    return NextResponse.json({
      success: true,
      currency: 'USDT_TRC20',
      address: balance.address,
      balance: balance.balance,
      source: 'TRON_BLOCKCHAIN',
    });
  } catch (error) {
    console.error('[USDT_TRC20_BALANCE]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'USDT_BALANCE_UNAVAILABLE',
        message: 'Impossible de consulter le solde USDT TRC-20.',
      },
      { status: 500 },
    );
  }
}
