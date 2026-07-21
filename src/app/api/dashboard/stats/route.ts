import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  // For now, we'll hardcode the agency ID. 
  // In a real app, this would come from the authenticated user's session.
  const agencyId = '01';

  try {
    const connection = await db.getConnection();
    
    // 1. Get Agency Balance
    const { rows: agencyRows } = await connection.query(
      `SELECT balances FROM agencies WHERE id = $1`,
      [agencyId]
    );
    const agencyData = agencyRows[0];
    const agencyBalanceUSD = agencyData ? (JSON.parse(agencyData.balances).USD || 0) : 0;

    // 2. Get Agency Clients Count - Updated to reflect new ID format
    const { rows: clientRows } = await connection.query(
      `SELECT COUNT(*) as count FROM users WHERE SUBSTRING(id_wallet, 3, 2) = $1 AND role = 'Client'`,
      [agencyId]
    );
    const agencyClients = clientRows[0].count || 0;

    // 3. Get Daily Transactions
    const { rows: transactionRows } = await connection.query(
      `SELECT COUNT(*) as count FROM transactions WHERE (SUBSTRING(sender_wallet_id, 3, 2) = $1 OR SUBSTRING(receiver_wallet_id, 3, 2) = $2) AND DATE(timestamp) = CURRENT_DATE`,
      [agencyId, agencyId]
    );
    const dailyTransactions = transactionRows[0].count || 0;
    
    // 4. Get Total Client Balance in USD
    const { rows: totalBalanceRows } = await connection.query(
      `SELECT SUM(CAST(balances->>'USD' AS NUMERIC)) as total FROM wallets w JOIN users u ON w.user_id = u.id WHERE SUBSTRING(u.id_wallet, 3, 2) = $1`,
      [agencyId]
    );
    const totalClientBalanceUSD = Number(totalBalanceRows[0].total) || 0;

    connection.release();

    return NextResponse.json({
      agencyBalanceUSD,
      agencyClients,
      dailyTransactions,
      totalClientBalanceUSD,
    });

  } catch (error) {
    console.error('API Error fetching dashboard stats:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Failed to fetch dashboard stats', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
