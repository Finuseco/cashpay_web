
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleDbError } from '@/lib/actions/helpers';
import type { PoolClient } from 'pg';

/**
 * Handles POST requests from the MaxiCash gateway to update transaction statuses.
 * This is a crucial webhook endpoint for payment confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('--- Received MaxiCash Webhook ---');
    console.log(JSON.stringify(body, null, 2));

    const reference = body.Ref;
    const statusCode = body.StatusCode; // e.g., "000" for success
    const statusMessage = body.Status;
    const maxiCashTransactionId = body.TransactionID;
    const cardLast4 = body.PaySource?.slice(-4); // Extract last 4 digits from PaySource (e.g., "400000******0002")

    if (!reference || !statusCode) {
      console.warn('[MaxiCash Webhook] Received invalid data, missing reference or status code.');
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const connection = await db.getConnection() as PoolClient;
    try {
        await connection.query('BEGIN');

        // Find the PENDING transaction using our internal reference code.
        const { rows: transRows } = await connection.query(
            "SELECT * FROM transactions WHERE reference_code = $1 AND status = 'Pending' FOR UPDATE", 
            [reference]
        );

        if (transRows.length === 0) {
            await connection.query('ROLLBACK');
            console.warn(`[MaxiCash Webhook] Pending transaction with reference ${reference} not found. It might have been processed already. Acknowledging receipt.`);
            // Acknowledge receipt to prevent MaxiCash from retrying.
            return NextResponse.json({ status: "OK", message: "Transaction not found or already processed." });
        }
        
        const transaction = transRows[0];
        
        if (statusCode === '000') { // Transaction Success
            // 1. Update our transaction status, description, and metadata
            const newDescription = cardLast4 ? `Dépôt par Carte •••• ${cardLast4}` : 'Dépôt par Carte Bancaire';
            await connection.query(
                'UPDATE transactions SET status = $1, description = $2, metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{externalReference,statusMessage}\', \'[$3, $4]\') WHERE id = $5', 
                ['Completed', newDescription, maxiCashTransactionId, statusMessage, transaction.id]
            );
            
            // 2. Credit the user's wallet now that payment is confirmed
            const amountToCredit = parseFloat(transaction.amount);
            const currency = transaction.currency;

            await connection.query(
                `UPDATE wallets SET balances = jsonb_set(COALESCE(balances, '{}'), '{${currency}}', (COALESCE((balances->>'${currency}')::numeric, 0) + $1)::text::jsonb) WHERE user_id = $2`,
                [amountToCredit, transaction.sender_id]
            );

            console.log(`[MaxiCash Webhook] Transaction ${reference} successfully processed and wallet credited for user ${transaction.sender_id}.`);
        } else { // Transaction Failed
            // Update the transaction status to 'Failed'
            await connection.query(
                'UPDATE transactions SET status = $1, metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{failure_reason,externalReference}\', \'[$2, $3]\') WHERE id = $4', 
                ['Failed', `MaxiCash status: ${statusCode} - ${statusMessage}`, maxiCashTransactionId, transaction.id]
            );
            console.log(`[MaxiCash Webhook] Transaction ${reference} failed. Status updated.`);
        }

        await connection.query('COMMIT');
        
        return NextResponse.json({ status: "OK", message: "Webhook processed." });

    } catch (dbError) {
        if(connection) await connection.query('ROLLBACK');
        console.error('[MaxiCash Webhook] Database error:', dbError);
        return NextResponse.json({ status: "OK", message: "Internal server error occurred." }, { status: 500 });
    } finally {
        if(connection) connection.release();
    }
    
  } catch (error) {
    console.error('[MaxiCash Webhook] Error parsing request body:', error);
    return new NextResponse('Bad Request', { status: 400 });
  }
}
