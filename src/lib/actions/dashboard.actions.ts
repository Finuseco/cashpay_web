
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { PoolClient } from 'pg';

export async function getDashboardStats(agencyId: string | null) {
  if (!agencyId) return null;

  const connection = await db.getConnection();
  try {
    const { rows: agencyRows } = await connection.query(
      `SELECT balances FROM agencies WHERE id = $1`,
      [agencyId]
    );
    const agencyData = agencyRows[0];
    const agencyBalanceUSD = agencyData ? (JSON.parse(agencyData.balances).USD || 0) : 0;

    const { rows: clientRows } = await connection.query(
      `SELECT COUNT(*) as count FROM users WHERE SUBSTRING(id_wallet, 3, 2) = $1 AND role = 'Client'`,
      [agencyId]
    );
    const agencyClients = clientRows[0].count || 0;

    const { rows: transactionRows } = await connection.query(
      `SELECT COUNT(*) as count FROM transactions WHERE (SUBSTRING(sender_wallet_id, 3, 2) = $1 OR SUBSTRING(receiver_wallet_id, 3, 2) = $2) AND DATE(timestamp) = CURRENT_DATE`,
      [agencyId, agencyId]
    );
    const dailyTransactions = transactionRows[0].count || 0;

    const { rows: totalBalanceRows } = await connection.query(
      `SELECT SUM(CAST(balances->>'USD' AS NUMERIC)) as total FROM wallets w JOIN users u ON w.user_id = u.id WHERE SUBSTRING(u.id_wallet, 3, 2) = $1`,
      [agencyId]
    );
    const totalClientBalanceUSD = Number(totalBalanceRows[0].total) || 0;

    return {
      agencyBalanceUSD,
      agencyClients,
      dailyTransactions,
      totalClientBalanceUSD,
    };
  } catch (error) {
    handleDbError(error, 'fetching dashboard stats');
    return null;
  } finally {
    connection.release();
  }
}
