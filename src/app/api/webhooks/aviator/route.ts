
'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleDbError } from '@/lib/actions/helpers';
import { createTransaction } from '@/lib/actions/transaction.actions';
import type { User } from '@/lib/types';
import type { PoolClient } from 'pg';

/**
 * Handles webhook notifications from the Aviator game server.
 * This is crucial for confirming bet outcomes and crediting wins.
 * https://docs.aviator.co/api/reference/webhooks
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('--- Received Aviator Webhook ---');
        console.log(JSON.stringify(body, null, 2));

        const { event_type, data } = body;
        const transactionId = data.transaction_id; // Our internal reference_code

        if (!event_type || !transactionId) {
            console.warn('[Aviator Webhook] Received invalid data, missing event_type or transaction_id.');
            return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
        }

        const connection = await db.getConnection() as PoolClient;
        try {
            await connection.query('BEGIN');

            const { rows: transRows } = await connection.query(
                "SELECT * FROM transactions WHERE reference_code = $1 AND type_code = 'BT' AND status = 'Pending' FOR UPDATE",
                [transactionId]
            );

            if (transRows.length === 0) {
                console.warn(`[Aviator Webhook] Pending bet transaction with reference ${transactionId} not found. Acknowledging receipt.`);
                await connection.query('ROLLBACK');
                return NextResponse.json({ status: "OK", message: "Transaction not found or already processed." });
            }

            const betTransaction = transRows[0];
            const user: Partial<User> = { id: betTransaction.sender_id, id_wallet: betTransaction.sender_wallet_id };

            if (event_type === 'bet_won') {
                const { amount, currency } = data.win;
                
                // Credit the user's wallet with the winnings
                const winTransactionResult = await createTransaction({
                    user: user as User,
                    typeCode: 'WG', // Win Gaming
                    amount: parseFloat(amount),
                    currency,
                    description: `Gain Aviator - Réf: ${transactionId}`,
                    metadata: { provider: 'aviator', original_bet_ref: transactionId },
                    status: 'Completed'
                });
                
                if (!winTransactionResult.success) {
                    throw new Error(`Failed to credit winnings for transaction ${transactionId}. Reason: ${winTransactionResult.error}`);
                }
                
                // Mark the original bet as completed
                await connection.query('UPDATE transactions SET status = $1, metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{outcome,win_amount}\', \'["won", $2]\') WHERE id = $3', ['Completed', amount, betTransaction.id]);

            } else if (event_type === 'bet_lost') {
                // Simply mark the original bet as completed (lost)
                await connection.query('UPDATE transactions SET status = $1, metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{outcome}\', \'"lost"\') WHERE id = $2', ['Completed', betTransaction.id]);
            } else {
                 console.log(`[Aviator Webhook] Received unhandled event_type: ${event_type}`);
            }

            await connection.query('COMMIT');
            return NextResponse.json({ status: "OK", message: "Webhook processed." });

        } catch (dbError: any) {
            await connection.query('ROLLBACK');
            console.error('[Aviator Webhook] Database error:', dbError);
            return NextResponse.json({ status: "ERROR", message: "Internal server error." }, { status: 500 });
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('[Aviator Webhook] Error parsing request body:', error);
        return new NextResponse('Bad Request', { status: 400 });
    }
}
