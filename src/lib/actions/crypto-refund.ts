// Aide serveur partagée par les retraits crypto externes (BTC, USDT).
// Volontairement SANS 'use server' : elle ne doit pas être appelable
// depuis le navigateur.

import { db } from '@/lib/db';

interface RefundArgs {
    withdrawalId: number;
    transactionId: number;
    userId: number;
    /** Code de la ligne user_crypto_balances (ex. 'BTC', 'USDT_TRC20'). */
    balanceCurrencyCode: string;
    /** Montant + frais réservés au départ. */
    totalDebit: number;
    reason: string;
}

/**
 * Annule un retrait dont on est CERTAIN qu'il n'a rien envoyé sur le réseau :
 * recrédite le solde, marque le retrait 'failed' et la transaction 'Failed'.
 *
 * Idempotent : le recrédit n'a lieu que si le retrait est encore 'pending'
 * (impossible de rembourser deux fois).
 */
export async function refundCryptoWithdrawal(
    args: RefundArgs
): Promise<boolean> {
    const client = await db.getConnection();

    try {
        await client.query('BEGIN');

        const marked = await client.query(
            `UPDATE crypto_withdrawals
             SET status = 'failed'
             WHERE id = $1
               AND status = 'pending'
             RETURNING id`,
            [args.withdrawalId]
        );

        if (marked.rowCount !== 1) {
            await client.query('ROLLBACK');
            return false;
        }

        await client.query(
            `UPDATE user_crypto_balances
             SET balance = balance + $1
             WHERE user_id = $2
               AND currency_code = $3`,
            [args.totalDebit, args.userId, args.balanceCurrencyCode]
        );

        await client.query(
            `UPDATE transactions
             SET status = 'Failed',
                 metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
             WHERE id = $2`,
            [
                JSON.stringify({
                    failureReason: args.reason,
                    refunded: true,
                }),
                args.transactionId,
            ]
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[Crypto Refund] Échec du rollback :', rollbackError);
        }

        console.error('[Crypto Refund] Remboursement impossible :', {
            ...args,
            error,
        });

        return false;
    } finally {
        client.release();
    }
}
