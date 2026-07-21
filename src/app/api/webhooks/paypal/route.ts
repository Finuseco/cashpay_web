
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/actions/notification.actions';
import { reverseTransaction } from '@/lib/actions/transaction.actions';

/**
 * Webhook centralisé pour PayPal Live (Orders V2 et Payouts V1).
 * Gère la souveraineté des crédits et les remboursements en cas d'échec.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const eventType = body.event_type;
        const resource = body.resource;

        console.log(`[PayPal Webhook] Received Event: ${eventType}`);

        const connection = await db.getConnection();
        try {
            await connection.query('BEGIN');

            // --- CAS 1 : DÉPÔT RÉUSSI (CAPTURE COMPLETED) ---
            if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
                const orderId = resource.supplementary_data?.related_ids?.order_id || resource.parent_payment || resource.id;
                
                const { rows } = await connection.query(
                    "SELECT * FROM transactions WHERE metadata->>'paypal_order_id' = $1 AND status = 'Pending' FOR UPDATE",
                    [orderId]
                );

                if (rows.length > 0) {
                    const tx = rows[0];
                    const amount = parseFloat(resource.amount.value);

                    await connection.query(
                        `UPDATE wallets SET balances = jsonb_set(COALESCE(balances, '{}'::jsonb), '{${tx.currency}}', (COALESCE((balances->>'${tx.currency}')::numeric, 0) + $1)::text::jsonb) WHERE user_id = $2`,
                        [amount, tx.sender_id]
                    );

                    await connection.query("UPDATE transactions SET status = 'Completed' WHERE id = $1", [tx.id]);
                    await createNotification(tx.sender_id, "Dépôt Confirmé", `Votre dépôt de ${amount} ${tx.currency} via PayPal a été crédité.`);
                }
            }

            // --- CAS 2 : ÉCHEC DE DÉPÔT (CAPTURE REJETÉE) ---
            if (eventType === 'PAYMENT.CAPTURE.DENIED') {
                await connection.query(
                    "UPDATE transactions SET status = 'Failed' WHERE metadata->>'paypal_order_id' = $1",
                    [resource.id]
                );
            }

            // --- CAS 3 : RETRAIT RÉUSSI (PAYOUT BATCH ITEM SUCCESS) ---
            if (eventType === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED') {
                const reference = resource.payout_item.sender_item_id;
                // Le montant est déjà dans le portefeuille de séquestre, on marque simplement comme terminé.
                await connection.query("UPDATE transactions SET status = 'Completed' WHERE reference_code = $1", [reference]);
            }

            // --- CAS 4 : ÉCHEC DE RETRAIT (REMBOURSEMENT AUTOMATIQUE VIA REVERSAL) ---
            if (eventType === 'PAYMENT.PAYOUTS-ITEM.FAILED' || eventType === 'PAYMENT.PAYOUTS-ITEM.BLOCKED') {
                const reference = resource.payout_item.sender_item_id;
                const { rows: txRows } = await connection.query("SELECT id FROM transactions WHERE reference_code = $1", [reference]);
                
                if (txRows.length > 0) {
                    await reverseTransaction(txRows[0].id, `Échec PayPal: ${resource.errors?.[0]?.message || 'Blocked'}`);
                }
            }

            await connection.query('COMMIT');
            return NextResponse.json({ success: true });

        } catch (dbError) {
            await connection.query('ROLLBACK');
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('[PayPal Webhook] Critical Error:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
