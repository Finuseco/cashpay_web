import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { PoolClient } from 'pg';

export async function POST(request: NextRequest) {
    let connection: PoolClient | null = null;

    try {
        const body = await request.json();

        console.log('--- Received MaxiCash Webhook ---');
        console.log(JSON.stringify(body, null, 2));

        const reference = String(body.Ref || '').trim();
        const statusCode = String(body.StatusCode || '').trim();
        const statusMessage = String(body.Status || '').trim();
        const maxiCashTransactionId = body.TransactionID
            ? String(body.TransactionID)
            : null;

        if (!reference || !statusCode) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid payload',
                },
                { status: 400 }
            );
        }

        connection = await db.getConnection();

        await connection.query('BEGIN');

        const { rows: transRows } = await connection.query(
            `SELECT *
             FROM transactions
             WHERE reference_code = $1
               AND status = 'Pending'
             FOR UPDATE`,
            [reference]
        );

        /*
         * Le webhook peut être renvoyé plusieurs fois par MaxiCash.
         * Si la transaction n'est plus Pending, elle a déjà été traitée.
         */
        if (transRows.length === 0) {
            await connection.query('ROLLBACK');

            return NextResponse.json({
                status: 'OK',
                message: 'Transaction already processed or not found.',
            });
        }

        const transaction = transRows[0];

        const metadata =
            typeof transaction.metadata === 'string'
                ? JSON.parse(transaction.metadata)
                : (transaction.metadata || {});

        /*
         * Paiement accepté par MaxiCash.
         */
        if (statusCode === '000') {
            const externalMetadata = {
                ...metadata,
                externalReference: maxiCashTransactionId,
                statusMessage,
                providerStatusCode: statusCode,
                confirmedAt: new Date().toISOString(),
            };

            await connection.query(
                `UPDATE transactions
                 SET status = 'Completed',
                     metadata = $1::jsonb
                 WHERE id = $2`,
                [
                    JSON.stringify(externalMetadata),
                    transaction.id,
                ]
            );

            /*
             * Crédit du wallet uniquement après confirmation MaxiCash.
             *
             * ARRAY[$1::text] évite de construire le chemin JSON
             * directement dans la requête SQL.
             */
            await connection.query(
                `UPDATE wallets
                 SET balances = jsonb_set(
                     COALESCE(balances, '{}'::jsonb),
                     ARRAY[$1::text],
                     (
                         COALESCE(balances ->> $1, '0')::numeric
                         + $2::numeric
                     )::text::jsonb
                 )
                 WHERE user_id = $3`,
                [
                    transaction.currency,
                    Number(transaction.amount),
                    transaction.sender_id,
                ]
            );

            console.log(
                `[MaxiCash Webhook] Deposit ${reference} completed. ` +
                `Wallet credited for user ${transaction.sender_id}.`
            );
        } else {
            /*
             * Paiement refusé/échoué.
             * Aucun crédit du wallet.
             */
            const failureMetadata = {
                ...metadata,
                externalReference: maxiCashTransactionId,
                failure_reason: `MaxiCash status: ${statusCode} - ${statusMessage}`,
                providerStatusCode: statusCode,
                failedAt: new Date().toISOString(),
            };

            await connection.query(
                `UPDATE transactions
                 SET status = 'Failed',
                     metadata = $1::jsonb
                 WHERE id = $2`,
                [
                    JSON.stringify(failureMetadata),
                    transaction.id,
                ]
            );

            console.log(
                `[MaxiCash Webhook] Deposit ${reference} failed: ` +
                `${statusCode} - ${statusMessage}`
            );
        }

        await connection.query('COMMIT');

        return NextResponse.json({
            status: 'OK',
            message: 'Webhook processed.',
            reference,
            transactionStatus:
                statusCode === '000' ? 'Completed' : 'Failed',
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.query('ROLLBACK');
            } catch {}
        }

        console.error('[MaxiCash Webhook] Error:', error);

        return NextResponse.json(
            {
                status: 'ERROR',
                message: 'Webhook processing failed.',
            },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
}
