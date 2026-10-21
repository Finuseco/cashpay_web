import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    const result = await db.query(
      `SELECT id, amount, tx_hash, status, confirmations,
              required_confirmations, created_at
       FROM crypto_deposits
       WHERE user_id = $1
         AND currency_code = 'USDT_TRC20'
       ORDER BY created_at DESC
       LIMIT 100`,
      [user.id],
    );

    return NextResponse.json({
      success: true,
      currency: 'USDT_TRC20',
      deposits: result.rows,
    });
  } catch (error) {
    console.error('[USDT_TRC20_DEPOSITS]', error);

    return NextResponse.json(
      { success: false, error: 'DEPOSIT_HISTORY_UNAVAILABLE' },
      { status: 500 },
    );
  }
}
