
'use server';

import { db } from '@/lib/db';
import { verifyUserPin } from './auth.actions';
import { calculateTransactionFee } from './wallet.actions';
import {
    sendBitcoinToAddress,
    validateBitcoinAddress,
    getBitcoinWalletBalance,
} from '@/services/bitcoin';
import { refundCryptoWithdrawal } from './crypto-refund';
import { sendTransactionNotifications } from './transaction.actions';
import { createNotification } from './notification.actions';
import { getUserFromDb } from './helpers';
import {
    generateReferenceCode,
    type TransactionTypeCode,
} from '../utils';

interface BitcoinTransferArgs {
    userId: number;
    recipientAddress: string;
    amount: number;
    pin: string;
}

const BTC_TYPE = 'WD_CRYPTO_MONEY' as TransactionTypeCode;

export async function prepareBitcoinTransfer(
    args: BitcoinTransferArgs
) {
    const { userId, recipientAddress, pin } = args;

    // Bitcoin : 8 décimales maximum. Le même montant arrondi sert au
    // débit en base ET à l'envoi au nœud (aucun écart possible).
    const amount = Number(Number(args.amount).toFixed(8));

    if (!Number.isInteger(userId) || userId <= 0) {
        return { success: false, error: 'Utilisateur invalide.' };
    }

    if (!recipientAddress) {
        return {
            success: false,
            error: 'Adresse Bitcoin destinataire requise.',
        };
    }
    let validAddress = false;
    try {
        validAddress = await validateBitcoinAddress(recipientAddress.trim());
    } catch (error) {
        console.error('[Bitcoin Transfer] Validation adresse impossible:', error);
        return {
            success: false,
            status: 'pending',
            error: 'Impossible de vérifier l’adresse Bitcoin auprès du nœud. Aucun débit effectué.',
        };
    }

    if (!validAddress) {
        return {
            success: false,
            error: 'Adresse Bitcoin invalide pour le réseau du nœud.',
        };
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return {
            success: false,
            error: 'Le montant BTC doit être supérieur à zéro.',
        };
    }

    if (!pin) {
        return { success: false, error: 'Le code PIN est requis.' };
    }

    const pinResult = await verifyUserPin(userId, pin);

    if (!pinResult.success) {
        return {
            success: false,
            error: pinResult.error || 'Code PIN incorrect.',
        };
    }

    const userResult = await db.query(
        `SELECT id, id_wallet, country
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId]
    );

    if (userResult.rowCount === 0) {
        return {
            success: false,
            error: 'Utilisateur CashPay introuvable.',
        };
    }

    const user = userResult.rows[0];

    // Calcul des frais avec la configuration existante.
    const feeConnection = await db.getConnection();
    let feeAmount: number;

    try {
        const configuredFee = await calculateTransactionFee(
            amount,
            'BTC',
            BTC_TYPE,
            user.country,
            feeConnection
        );

        feeAmount = Number(configuredFee);

        if (!Number.isFinite(feeAmount) || feeAmount < 0) {
            return {
                success: false,
                error: 'Frais Bitcoin invalides.',
            };
        }
    } finally {
        feeConnection.release();
    }

    const totalDebit = Number((amount + feeAmount).toFixed(8));

    if (!Number.isFinite(totalDebit)) {
        return {
            success: false,
            error: 'Montant total du transfert invalide.',
        };
    }

    // Liquidité du nœud : on ne débite pas l'utilisateur si le portefeuille
    // Bitcoin Core ne peut de toute façon pas payer ce transfert.
    try {
        const nodeBalance = await getBitcoinWalletBalance();

        if (nodeBalance < amount) {
            return {
                success: false,
                error: 'Liquidité Bitcoin insuffisante pour le moment. Aucun débit effectué.',
            };
        }
    } catch (error) {
        console.error('[BTC] Solde du nœud indisponible :', error);

        return {
            success: false,
            error: 'Service Bitcoin momentanément indisponible. Aucun débit effectué.',
        };
    }

    const client = await db.getConnection();

    let withdrawalId: number | null = null;
    let transactionId: number | null = null;
    let referenceCode = '';
    let reservationCommitted = false;
    let newBalance = 0;

    try {
        // 1. Réserver le solde et créer les traces AVANT l'envoi.
        await client.query('BEGIN');

        const balanceResult = await client.query(
            `SELECT balance
             FROM user_crypto_balances
             WHERE user_id = $1
               AND currency_code = 'BTC'
             FOR UPDATE`,
            [userId]
        );

        if (balanceResult.rowCount === 0) {
            throw new Error('Compte Bitcoin introuvable.');
        }

        const balance = Number(balanceResult.rows[0].balance);

        if (!Number.isFinite(balance) || balance < 0) {
            throw new Error('Solde Bitcoin invalide.');
        }

        if (balance < totalDebit) {
            await client.query('ROLLBACK');

            return {
                success: false,
                error: 'Solde Bitcoin insuffisant.',
                amount,
                fee: feeAmount,
                totalDebit,
                availableBalance: balance,
            };
        }

        const withdrawalResult = await client.query(
            `INSERT INTO crypto_withdrawals (
                user_id,
                currency_code,
                amount,
                recipient_address,
                status,
                tx_hash
            )
            VALUES ($1, 'BTC', $2, $3, 'pending', NULL)
            RETURNING id`,
            [userId, amount, recipientAddress]
        );

        withdrawalId = Number(withdrawalResult.rows[0]?.id);

        if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
            throw new Error('Impossible de créer le retrait Bitcoin.');
        }

        // Réservation comptable atomique du montant et des frais.
        const debitResult = await client.query(
            `UPDATE user_crypto_balances
             SET balance = balance - $1
             WHERE user_id = $2
               AND currency_code = 'BTC'
               AND balance >= $1
             RETURNING balance`,
            [totalDebit, userId]
        );

        if (debitResult.rowCount !== 1) {
            throw new Error('Impossible de réserver le solde Bitcoin.');
        }

        newBalance = Number(debitResult.rows[0].balance);

        referenceCode = generateReferenceCode(BTC_TYPE);

        const transactionResult = await client.query(
            `INSERT INTO transactions (
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
                $1, $2, 'Pending', $3, 'BTC', $4, $5,
                $6, NULL, $7, NULL, $8::jsonb, NULL
            )
            RETURNING id`,
            [
                referenceCode,
                'WD_CRYPTO_MONEY',
                amount,
                feeAmount,
                'Transfert Bitcoin via OnChat',
                userId,
                user.id_wallet,
                JSON.stringify({
                    source: 'onchat',
                    currency: 'BTC',
                    recipientAddress,
                    withdrawalId,
                    feeCurrency: 'BTC',
                    feeTypeCode: 'WD_CRYPTO_MONEY',
                }),
            ]
        );

        transactionId = Number(transactionResult.rows[0]?.id);

        if (!Number.isInteger(transactionId) || transactionId <= 0) {
            throw new Error('Impossible de créer la transaction Bitcoin.');
        }

        await client.query('COMMIT');
        reservationCommitted = true;

    } catch (error: any) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[BTC] Échec du rollback :', rollbackError);
        }

        console.error('[BTC] Échec de la réservation :', error);

        return {
            success: false,
            error: 'Impossible de préparer le transfert Bitcoin.',
        };
    } finally {
        client.release();
    }

    if (!reservationCommitted || !withdrawalId || !transactionId) {
        return {
            success: false,
            error: 'La réservation du transfert Bitcoin a échoué.',
        };
    }

    // 2. L'envoi réseau intervient après la réservation persistante.
    let txHash: string;

    try {
        txHash = await sendBitcoinToAddress(
            recipientAddress,
            amount,
            referenceCode
        );

        if (typeof txHash !== 'string' || !txHash.trim()) {
            throw new Error('Aucun TXID retourné par Bitcoin Core.');
        }

        txHash = txHash.trim();
    } catch (error: any) {
        // Le nœud a répondu par une erreur RPC explicite (fonds insuffisants,
        // adresse refusée, transaction rejetée…) : RIEN n'a été envoyé.
        // On peut donc recréditer l'utilisateur en toute sécurité.
        if (error?.definitive === true) {
            const refunded = await refundCryptoWithdrawal({
                withdrawalId,
                transactionId,
                userId,
                balanceCurrencyCode: 'BTC',
                totalDebit,
                reason: String(error?.message || 'Refus du nœud Bitcoin'),
            });

            console.error('[BTC] Envoi refusé par le nœud :', {
                withdrawalId,
                transactionId,
                referenceCode,
                refunded,
                rpcCode: error?.rpcCode,
                error: error?.message,
            });

            if (refunded) {
                return {
                    success: false,
                    withdrawalId,
                    transactionId,
                    reference: referenceCode,
                    error:
                        'Le transfert Bitcoin a été refusé par le réseau. ' +
                        'Votre solde a été recrédité.',
                };
            }
            // Si le remboursement échoue, on retombe sur le cas "incertain" :
            // le montant reste réservé et la réconciliation se fait à la main.
        }

        // Résultat réseau incertain (pas de réponse exploitable du nœud) :
        // ne PAS rembourser ni marquer failed automatiquement.
        console.error('[BTC] Résultat réseau à vérifier :', {
            withdrawalId,
            transactionId,
            referenceCode,
            error: error?.message,
        });

        return {
            success: false,
            status: 'pending',
            withdrawalId,
            transactionId,
            reference: referenceCode,
            error:
                'Résultat du transfert incertain. Le montant reste réservé. ' +
                'Vérifiez Bitcoin Core et le TXID avant toute nouvelle tentative.',
        };
    }

    // 3. Enregistrer le TXID et finaliser les deux traces.
    const finalClient = await db.getConnection();

    try {
        await finalClient.query('BEGIN');

        await finalClient.query(
            `UPDATE crypto_withdrawals
             SET status = 'completed', tx_hash = $1
             WHERE id = $2`,
            [txHash, withdrawalId]
        );

        await finalClient.query(
            `UPDATE transactions
             SET status = 'Completed', btc_tx_hash = $1
             WHERE id = $2`,
            [txHash, transactionId]
        );

        await finalClient.query('COMMIT');
    } catch (error) {
        try {
            await finalClient.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[BTC] Échec du rollback final :', rollbackError);
        }

        // Les BTC peuvent être déjà envoyés : conserver les traces
        // en attente et le TXID dans les journaux pour réconciliation.
        console.error('[BTC] TXID à réconcilier manuellement :', {
            txHash,
            withdrawalId,
            transactionId,
            referenceCode,
            error,
        });

        return {
            success: false,
            status: 'pending',
            withdrawalId,
            transactionId,
            reference: referenceCode,
            txHash,
            error:
                'Les BTC ont été soumis, mais la finalisation comptable ' +
                'doit être réconciliée. Ne relancez pas le transfert.',
        };
    } finally {
        finalClient.release();
    }

    // 4. Les notifications ne doivent pas modifier le résultat comptable.
    try {
        await createNotification(
            userId,
            `Transfert Bitcoin de ${amount} BTC`,
            `Transfert Bitcoin effectué. Frais : ${feeAmount} BTC. Réf. : ${referenceCode}.`,
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
    } catch (error) {
        console.error('[BTC] Notification interne non envoyée :', error);
    }

    try {
        const notificationUser = await getUserFromDb({ userId });

        if (notificationUser) {
            await sendTransactionNotifications(notificationUser, {
                description: 'Transfert Bitcoin via OnChat',
                amount,
                currency: 'BTC',
                fee: feeAmount,
                reference: referenceCode,
                newBalance,
                typeCode: 'WD_CRYPTO_MONEY',
            });
        }
    } catch (error) {
        console.error('[BTC] Notification externe non envoyée :', error);
    }

    return {
        success: true,
        status: 'completed',
        userId,
        walletId: user.id_wallet,
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
}
