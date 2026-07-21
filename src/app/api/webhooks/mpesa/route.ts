
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { PoolClient } from 'pg';

/**
 * Handles POST requests from the M-Pesa API to update transaction statuses.
 * This is a webhook (callback) endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('--- Received M-Pesa Webhook ---');
    console.log(JSON.stringify(body, null, 2));

    const result = body.Result;
    if (!result || !result.ResultParameters) {
      console.warn('[M-Pesa Webhook] Received invalid data format.');
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Invalid format' });
    }

    const resultCode = result.ResultCode;
    const resultDesc = result.ResultDesc;
    const checkoutRequestID = result.CheckoutRequestID;

    // Find the original transaction using the reference (AccountReference)
    const accountReference = result.ResultParameters.ResultParameter.find((p: any) => p.Key === 'AccountReference')?.Value;
    
    if (!accountReference) {
        console.warn(`[M-Pesa Webhook] Could not find AccountReference in payload for checkout ID ${checkoutRequestID}.`);
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    
    const { rows: transRows } = await db.query('SELECT id, sender_id, amount, currency FROM transactions WHERE reference_code = $1 AND status = \'Pending\'', [accountReference]);

    if (transRows.length === 0) {
        console.warn(`[M-Pesa Webhook] Pending transaction with reference ${accountReference} not found.`);
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const transaction = transRows[0];

    if (resultCode === 0) { // Success
        await db.query('UPDATE transactions SET status = $1, metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{mpesaReceiptNumber,mpesaResult}\', to_jsonb(ARRAY[$2::text, $3::text])) WHERE id = $4', 
            ['Completed', result.ResultParameters.ResultParameter.find((p: any) => p.Key === 'MpesaReceiptNumber')?.Value, JSON.stringify(result), transaction.id]);
        console.log(`[M-Pesa Webhook] Transaction ${accountReference} completed successfully.`);
    } else { // Failure
        await db.query('UPDATE transactions SET status = $1, metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{failure_reason,mpesaResult}\', to_jsonb(ARRAY[$2::text, $3::text])) WHERE id = $4', 
            ['Failed', resultDesc, JSON.stringify(result), transaction.id]);

        // Refund the user if the transaction failed
        await db.query(`UPDATE wallets SET balances = jsonb_set(COALESCE(balances, '{}'), '{${transaction.currency}}', ((balances->>'${transaction.currency}')::numeric + $1)::text::jsonb) WHERE user_id = $2`,
            [transaction.amount, transaction.sender_id]);
        
        console.log(`[M-Pesa Webhook] Transaction ${accountReference} failed. Status updated and funds refunded to user ${transaction.sender_id}.`);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  } catch (error) {
    console.error('[M-Pesa Webhook] Error processing webhook:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
