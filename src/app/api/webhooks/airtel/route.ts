
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reverseTransaction } from '@/lib/actions/transaction.actions';
import type { PoolClient } from 'pg';

/**
 * Handles POST requests from the Airtel Money API to update transaction statuses.
 * Webhook pour les paiements entrants et sortants.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transactionId = body.transaction?.id; // reference_code
    const airtelTransactionId = body.transaction?.airtel_money_id;
    const status = body.transaction?.status_code; // 'TS' pour succès, 'TF' pour échec

    if (!transactionId || !status) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const connection = await db.getConnection() as PoolClient;
    try {
        await connection.query('BEGIN');

        const { rows: transRows } = await connection.query(
            'SELECT id, status, type_code FROM transactions WHERE reference_code = $1 FOR UPDATE', 
            [transactionId]
        );

        if (transRows.length === 0) {
            await connection.query('ROLLBACK');
            return NextResponse.json({ status: "SUCCESS", message: "Transaction ignored" });
        }
        
        const transaction = transRows[0];
        
        if (transaction.status === 'Pending') {
            if (status === 'TS') {
                await connection.query('UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3', 
                    ['Completed', JSON.stringify({ externalReference: airtelTransactionId }), transaction.id]);
            } else {
                // Si c'est un retrait qui a échoué, on utilise la logique souveraine de Reversal
                if (transaction.type_code.startsWith('WD_') || transaction.type_code === 'INTL_SEND') {
                    await reverseTransaction(transaction.id, `Airtel: ${body.transaction?.message || 'Transaction failed'}`);
                } else {
                    await connection.query('UPDATE transactions SET status = \'Failed\' WHERE id = $1', [transaction.id]);
                }
            }
        }

        await connection.query('COMMIT');
        return NextResponse.json({ status: "SUCCESS", message: "Processed" });

    } catch (dbError) {
        if(connection) await connection.query('ROLLBACK');
        return NextResponse.json({ status: "FAILED" }, { status: 500 });
    } finally {
        if(connection) connection.release();
    }
    
  } catch (error) {
    return new NextResponse('Bad Request', { status: 400 });
  }
}
