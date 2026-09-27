'use server';

import { db } from '@/lib/db';
import { verifyUserPin } from './auth.actions';
import { calculateTransactionFee } from './wallet.actions';
import { sendBitcoinToAddress } from '@/services/bitcoin';
import { sendTransactionNotifications } from './transaction.actions';
import { createNotification } from './notification.actions';
import { getUserFromDb } from './helpers';
import { generateReferenceCode, type TransactionTypeCode } from '../utils';

interface BitcoinTransferArgs {
    userId: number;
    recipientAddress: string;
    amount: number;
    pin: string;
}

export async function prepareBitcoinTransfer(
    args: BitcoinTransferArgs
) {
    const {
        userId,
        recipientAddress,
        amount,
        pin,
    } = args;

    if (!Number.isInteger(userId) || userId <= 0) {
        return {
            success: false,
            error: 'Utilisateur invalide.',
        };
    }

    if (!recipientAddress) {
        return {
            success: false,
            error: 'Adresse Bitcoin destinataire requise.',
        };
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return {
            success: false,
            error: 'Le montant BTC doit être supérieur à zéro.',
        };
    }

    if (!pin) {
        return {
            success: false,
            error: 'Le code PIN est requis.',
        };
    }

    const pinResult = await verifyUserPin(userId, pin);

    if (!pinResult.success) {
        return {
            success: false,
            error: pinResult.error || 'Code PIN incorrect.',
        };
    }

    const userResult = await db.query(
        `
        SELECT
            id,
            id_wallet,
            country
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
    );

    if (userResult.rowCount === 0) {
        return {
            success: false,
            error: 'Utilisateur CashPay introuvable.',
        };
    }

    const userRow = userResult.rows[0];

    /*
     * Le type WD_CRYPTO_MONEY est utilisé par le moteur
     * de transactions pour déterminer les frais.
     *
     * Aucun taux de 1 % n'est codé ici.
     * La valeur est récupérée depuis la configuration
     * existante du moteur de frais.
     */
    const fee = await calculateTransactionFee(
        amount,
        'BTC',
        'WD_CRYPTO_MONEY' as TransactionTypeCode,
        userRow.country,
        await db.getConnection()
    );

    const feeAmount = Number(fee || 0);
    const totalDebit = amount + feeAmount;

    if (!Number.isFinite(feeAmount) || feeAmount < 0) {
        return {
            success: false,
            error: 'Frais Bitcoin invalides.',
        };
    }

    const balanceResult = await db.query(
        `
        SELECT
            user_id,
            currency_code,
            balance
        FROM user_crypto_balances
        WHERE user_id = $1
          AND currency_code = 'BTC'
        LIMIT 1
        `,
        [userId]
    );

    if (balanceResult.rowCount === 0) {
        return {
            success: false,
            error: 'Compte Bitcoin introuvable.',
        };
    }

    const balance = Number(
        balanceResult.rows[0].balance || 0
    );

    if (!Number.isFinite(balance)) {
        return {
            success: false,
            error: 'Solde Bitcoin invalide.',
        };
    }

    if (balance < totalDebit) {
        return {
            success: false,
            error:
                `Solde Bitcoin insuffisant. Requis: ${totalDebit} BTC ` +
                `(montant: ${amount} BTC + frais: ${feeAmount} BTC), ` +
                `disponible: ${balance} BTC.`,
        };
    }

    let withdrawalId: number | null = null;

    try {
        /*
         * Trace technique du retrait Bitcoin.
         * Le statut pending n'est pas une approbation.
         */
        const withdrawalResult = await db.query(
            `
            INSERT INTO crypto_withdrawals (
                user_id,
                currency_code,
                amount,
                recipient_address,
                status,
                tx_hash
            )
            VALUES (
                $1,
                'BTC',
                $2,
                $3,
                'pending',
                NULL
            )
            RETURNING id
            `,
            [
                userId,
                amount,
                recipientAddress,
            ]
        );

        withdrawalId =
            withdrawalResult.rows[0]?.id ?? null;

        if (!withdrawalId) {
            return {
                success: false,
                error: 'Impossible de créer le retrait Bitcoin.',
            };
        }

        /*
         * Envoi direct vers Bitcoin Core.
         * Aucun workflow d'approbation humaine.
         */
        const txHash = await sendBitcoinToAddress(
            recipientAddress,
            amount
        );

        if (!txHash) {
            throw new Error(
                'Bitcoin Core n’a retourné aucun TX hash.'
            );
        }

        const client = await db.getConnection();

        try {
            await client.query('BEGIN');

            /*
             * Verrouillage du solde BTC avant débit.
             */
            const lockedBalanceResult =
                await client.query(
                    `
                    SELECT balance
                    FROM user_crypto_balances
                    WHERE user_id = $1
                      AND currency_code = 'BTC'
                    FOR UPDATE
                    `,
                    [userId]
                );

            if (lockedBalanceResult.rowCount === 0) {
                throw new Error(
                    'Compte Bitcoin introuvable lors de la finalisation.'
                );
            }

            const currentBalance = Number(
                lockedBalanceResult.rows[0].balance || 0
            );

            if (
                !Number.isFinite(currentBalance) ||
                currentBalance < totalDebit
            ) {
                throw new Error(
                    'Solde Bitcoin insuffisant lors de la finalisation.'
                );
            }

            /*
             * Débit du montant + frais.
             * Le destinataire reçoit uniquement amount.
             */
            await client.query(
                `
                UPDATE user_crypto_balances
                SET balance = balance - $1
                WHERE user_id = $2
                  AND currency_code = 'BTC'
                `,
                [
                    totalDebit,
                    userId,
                ]
            );

            const referenceCode =
                generateReferenceCode(
                    'WD_CRYPTO_MONEY' as TransactionTypeCode
                );

            /*
             * Trace dans la table générale des transactions.
             */
            const transactionResult =
                await client.query(
                    `
                    INSERT INTO transactions (
                        reference_code,
                        type_code,
                        status,
                        amount,
                        currency,
                        fee,
                        description,
                        sender_id,
                        receiver_id,
                        sender_wallet_id,
                        receiver_wallet_id,
                        metadata,
                        btc_tx_hash
                    )
                    VALUES (
                        $1,
                        $2,
                        'Completed',
                        $3,
                        'BTC',
                        $4,
                        $5,
                        $6,
                        NULL,
                        $7,
                        NULL,
                        $8::jsonb,
                        $9
                    )
                    RETURNING id
                    `,
                    [
                        referenceCode,
                        'WD_CRYPTO_MONEY',
                        amount,
                        feeAmount,
                        'Transfert Bitcoin via OnChat',
                        userId,
                        userRow.id_wallet,
                        JSON.stringify({
                            source: 'onchat',
                            currency: 'BTC',
                            recipientAddress,
                            bitcoinTxHash: txHash,
                            withdrawalId,
                            feeCurrency: 'BTC',
                            feeTypeCode: 'WD_CRYPTO_MONEY',
                        }),
                        txHash,
                    ]
                );

            const transactionId =
                transactionResult.rows[0]?.id;

            if (!transactionId) {
                throw new Error(
                    'Impossible de créer la trace de transaction Bitcoin.'
                );
            }

            /*
             * Finalisation du retrait technique.
             */
            await client.query(
                `
                UPDATE crypto_withdrawals
                SET
                    status = 'completed',
                    tx_hash = $1
                WHERE id = $2
                `,
                [
                    txHash,
                    withdrawalId,
                ]
            );

            await client.query('COMMIT');

            /*
             * Notification interne.
             */
            await createNotification(
                userId,
                `Transfert Bitcoin de ${amount} BTC`,
                `Votre transfert Bitcoin a été effectué. Frais: ${feeAmount} BTC. Réf: ${referenceCode}.`,
                'new_message',
                {
                    transactionId,
                    txHash,
                    withdrawalId,
                    currency: 'BTC',
                    amount,
                    fee: feeAmount,
                    recipientAddress,
                }
            );

            /*
             * Notifications email / SMS / WhatsApp
             * via le mécanisme CashPay existant.
             */
            const notificationUser =
                await getUserFromDb(userId);

            if (notificationUser) {
                await sendTransactionNotifications(
                    notificationUser,
                    {
                        description:
                            'Transfert Bitcoin via OnChat',
                        amount,
                        currency: 'BTC',
                        fee: feeAmount,
                        reference: referenceCode,
                        newBalance:
                            currentBalance - totalDebit,
                        typeCode:
                            'WD_CRYPTO_MONEY',
                    }
                );
            }

            return {
                success: true,
                userId,
                walletId: userRow.id_wallet,
                recipientAddress,
                amount,
                currency: 'BTC',
                fee: feeAmount,
                totalDebit,
                txHash,
                withdrawalId,
                transactionId,
                reference: referenceCode,
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: any) {
        if (withdrawalId) {
            try {
                await db.query(
                    `
                    UPDATE crypto_withdrawals
                    SET status = 'failed'
                    WHERE id = $1
                    `,
                    [withdrawalId]
                );
            } catch (updateError) {
                console.error(
                    '[Bitcoin Transfer] Failed to mark withdrawal as failed:',
                    updateError
                );
            }
        }

        console.error(
            '[Bitcoin Transfer] Bitcoin transfer failed:',
            error
        );

        return {
            success: false,
            error:
                error?.message ||
                'Le transfert Bitcoin a échoué.',
            withdrawalId,
        };
    }
}
