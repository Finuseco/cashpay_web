// Retrait USDT (TRC-20) vers une adresse EXTERNE à CashPay.
// Même logique que bitcoin-transfer.actions.ts : réserver le solde AVANT
// l'envoi, ne rembourser que si l'échec est certain, sinon laisser "pending".
// Module serveur uniquement (pas de 'use server').

import { db } from '@/lib/db';
import { verifyUserPin } from './auth.actions';
import { calculateTransactionFee } from './wallet.actions';
import { sendTransactionNotifications } from './transaction.actions';
import { createNotification } from './notification.actions';
import { getUserFromDb } from './helpers';
import { refundCryptoWithdrawal } from './crypto-refund';
import {
    generateReferenceCode,
    type TransactionTypeCode,
} from '../utils';
import {
    isBase58TronAddress,
    getTronHotWalletStatus,
    buildSignedUsdtTransfer,
    broadcastSignedTronTransaction,
    waitForTronTransaction,
    type SignedTronTransfer,
} from '@/services/tron';
import { USDT_CURRENCY_CODE } from '@/services/usdt';

interface UsdtTransferArgs {
    userId: number;
    recipientAddress: string;
    amount: number;
    pin: string;
}

const USDT_TYPE = 'WD_CRYPTO_MONEY' as TransactionTypeCode;

/** Plancher d'un retrait externe : en dessous, l'énergie TRX coûte plus cher que le transfert. */
function minExternalWithdrawal(): number {
    const configured = Number(process.env.USDT_MIN_EXTERNAL_WITHDRAWAL);

    return Number.isFinite(configured) && configured > 0 ? configured : 1;
}

export async function prepareUsdtTransfer(args: UsdtTransferArgs) {
    const { userId, pin } = args;
    const recipientAddress = String(args.recipientAddress ?? '').trim();

    // USDT : 6 décimales maximum. Le même montant sert au débit et à l'envoi.
    const amount = Number(Number(args.amount).toFixed(6));

    if (!Number.isInteger(userId) || userId <= 0) {
        return { success: false, error: 'Utilisateur invalide.' };
    }

    if (!isBase58TronAddress(recipientAddress)) {
        return {
            success: false,
            error: 'Adresse TRON (TRC-20) invalide.',
        };
    }

    if (!Number.isFinite(amount) || amount < 0.000001) {
        return {
            success: false,
            error: 'Le montant USDT doit être supérieur à zéro.',
        };
    }

    if (amount < minExternalWithdrawal()) {
        return {
            success: false,
            error: `Le retrait USDT vers une adresse externe doit être d'au moins ${minExternalWithdrawal()} USDT.`,
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

    // Frais : même règle de configuration que le transfert interne USDT.
    const feeConnection = await db.getConnection();
    let feeAmount: number;

    try {
        const configuredFee = await calculateTransactionFee(
            amount,
            'USDT',
            USDT_TYPE,
            user.country,
            feeConnection
        );

        feeAmount = Number(configuredFee);

        if (!Number.isFinite(feeAmount) || feeAmount < 0) {
            return { success: false, error: 'Frais USDT invalides.' };
        }
    } finally {
        feeConnection.release();
    }

    const totalDebit = Number((amount + feeAmount).toFixed(6));

    // Liquidité du portefeuille chaud : on ne débite pas l'utilisateur si le
    // réseau ne peut pas payer ce retrait (USDT à envoyer + TRX pour l'énergie).
    try {
        const hot = await getTronHotWalletStatus();
        const minTrx = Number(process.env.TRON_MIN_TRX_RESERVE) || 40;

        // Envoyer au portefeuille chaud lui-même ne servirait à rien (et ne
        // serait crédité à personne).
        if (recipientAddress === hot.address) {
            return {
                success: false,
                error: 'Cette adresse n’est pas valide comme destinataire.',
            };
        }

        if (hot.usdt < amount || hot.trx < minTrx) {
            console.error('[USDT] Liquidité insuffisante :', {
                hotUsdt: hot.usdt,
                hotTrx: hot.trx,
                requested: amount,
            });

            return {
                success: false,
                error: 'Liquidité USDT insuffisante pour le moment. Aucun débit effectué.',
            };
        }
    } catch (error) {
        console.error('[USDT] Portefeuille chaud indisponible :', error);

        return {
            success: false,
            error: 'Service USDT momentanément indisponible. Aucun débit effectué.',
        };
    }

    // La transaction est construite et SIGNÉE avant toute écriture : son TXID est
    // alors connu et sera enregistré avec la réservation. Si l'envoi se passe
    // mal au pire moment (coupure, délai dépassé…), on retrouve toujours ce que
    // le réseau en a fait. Un échec ici = rien n'a été débité ni diffusé.
    let signed: SignedTronTransfer;

    try {
        signed = await buildSignedUsdtTransfer(recipientAddress, amount);
    } catch (error: any) {
        console.error('[USDT] Transaction non construite :', error);

        return {
            success: false,
            error: 'Impossible de préparer la transaction USDT. Aucun débit effectué.',
        };
    }

    const txHash = signed.txid;

    const client = await db.getConnection();

    let withdrawalId: number | null = null;
    let transactionId: number | null = null;
    let referenceCode = '';
    let newBalance = 0;
    let reservationCommitted = false;

    try {
        // 1. Réserver le solde et créer les traces AVANT l'envoi.
        await client.query('BEGIN');

        const balanceResult = await client.query(
            `SELECT balance
             FROM user_crypto_balances
             WHERE user_id = $1
               AND currency_code = $2
             FOR UPDATE`,
            [userId, USDT_CURRENCY_CODE]
        );

        if (balanceResult.rowCount === 0) {
            await client.query('ROLLBACK');

            return { success: false, error: 'Compte USDT introuvable.' };
        }

        const balance = Number(balanceResult.rows[0].balance);

        if (!Number.isFinite(balance) || balance < 0) {
            throw new Error('Solde USDT invalide.');
        }

        if (balance < totalDebit) {
            await client.query('ROLLBACK');

            return {
                success: false,
                error: 'Solde USDT insuffisant (montant + frais).',
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
            VALUES ($1, $2, $3, $4, 'pending', $5)
            RETURNING id`,
            [userId, USDT_CURRENCY_CODE, amount, recipientAddress, txHash]
        );

        withdrawalId = Number(withdrawalResult.rows[0]?.id);

        if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
            throw new Error('Impossible de créer le retrait USDT.');
        }

        const debitResult = await client.query(
            `UPDATE user_crypto_balances
             SET balance = balance - $1
             WHERE user_id = $2
               AND currency_code = $3
               AND balance >= $1
             RETURNING balance`,
            [totalDebit, userId, USDT_CURRENCY_CODE]
        );

        if (debitResult.rowCount !== 1) {
            throw new Error('Impossible de réserver le solde USDT.');
        }

        newBalance = Number(debitResult.rows[0].balance);

        referenceCode = generateReferenceCode(USDT_TYPE);

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
                $1, $2, 'Pending', $3, 'USDT', $4, $5,
                $6, NULL, $7, NULL, $8::jsonb, NULL
            )
            RETURNING id`,
            [
                referenceCode,
                'WD_CRYPTO_MONEY',
                amount,
                feeAmount,
                'Transfert USDT externe (TRC-20)',
                userId,
                user.id_wallet,
                JSON.stringify({
                    source: 'external_withdrawal',
                    currency: 'USDT',
                    network: 'TRC20',
                    recipientAddress,
                    withdrawalId,
                    txHash,
                    feeCurrency: 'USDT',
                    feeTypeCode: 'WD_CRYPTO_MONEY',
                }),
            ]
        );

        transactionId = Number(transactionResult.rows[0]?.id);

        if (!Number.isInteger(transactionId) || transactionId <= 0) {
            throw new Error('Impossible de créer la transaction USDT.');
        }

        await client.query('COMMIT');
        reservationCommitted = true;
    } catch (error: any) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[USDT] Échec du rollback :', rollbackError);
        }

        console.error('[USDT] Échec de la réservation :', error);

        return {
            success: false,
            error: 'Impossible de préparer le transfert USDT.',
        };
    } finally {
        client.release();
    }

    if (!reservationCommitted || !withdrawalId || !transactionId) {
        return {
            success: false,
            error: 'La réservation du transfert USDT a échoué.',
        };
    }

    // 2. Diffusion de la transaction DÉJÀ signée (son TXID est enregistré).
    const broadcast = await broadcastSignedTronTransaction(
        signed.signedTransaction
    );

    if (broadcast.status === 'rejected') {
        // Le nœud l'a explicitement refusée : rien n'est parti, remboursement sûr.
        const refunded = await refundCryptoWithdrawal({
            withdrawalId,
            transactionId,
            userId,
            balanceCurrencyCode: USDT_CURRENCY_CODE,
            totalDebit,
            reason: String(broadcast.detail ?? 'Transaction refusée par le réseau TRON').slice(0, 300),
        });

        console.error('[USDT] Envoi refusé par le réseau :', {
            withdrawalId,
            transactionId,
            referenceCode,
            txHash,
            refunded,
            detail: broadcast.detail,
        });

        if (refunded) {
            return {
                success: false,
                withdrawalId,
                transactionId,
                reference: referenceCode,
                error:
                    'Le transfert USDT a été refusé par le réseau. ' +
                    'Votre solde a été recrédité.',
            };
        }
    }

    if (broadcast.status === 'unknown') {
        // Pas de réponse exploitable : la transaction est peut-être partie.
        // Le TXID est déjà enregistré : la tâche planifiée vérifiera sur la
        // blockchain, finalisera ou recréditera automatiquement.
        console.error('[USDT] Résultat de diffusion incertain :', {
            withdrawalId,
            transactionId,
            referenceCode,
            txHash,
            detail: broadcast.detail,
        });

        return {
            success: false,
            status: 'pending',
            withdrawalId,
            transactionId,
            reference: referenceCode,
            txHash,
            error:
                'Résultat du transfert incertain, vérification automatique en cours. ' +
                'Le montant reste réservé. Ne relancez pas le transfert.',
        };
    }

    // 4. Résultat on-chain (≈ 3 à 6 s en général).
    const outcome = await waitForTronTransaction(txHash);

    if (outcome === 'failed') {
        const refunded = await refundCryptoWithdrawal({
            withdrawalId,
            transactionId,
            userId,
            balanceCurrencyCode: USDT_CURRENCY_CODE,
            totalDebit,
            reason: `Transaction TRON échouée (${txHash})`,
        });

        console.error('[USDT] Transaction échouée sur la blockchain :', {
            txHash,
            withdrawalId,
            transactionId,
            refunded,
        });

        if (refunded) {
            return {
                success: false,
                withdrawalId,
                transactionId,
                reference: referenceCode,
                txHash,
                error:
                    'Le transfert USDT a échoué sur le réseau. ' +
                    'Votre solde a été recrédité.',
            };
        }
    }

    if (outcome !== 'success') {
        // Diffusé mais pas encore confirmé (ou remboursement impossible) :
        // le retrait reste "pending" avec son TXID, la tâche planifiée le finalisera.
        return {
            success: false,
            status: 'pending',
            withdrawalId,
            transactionId,
            reference: referenceCode,
            txHash,
            error:
                'Le transfert USDT a été diffusé, sa confirmation est en cours. ' +
                'Ne relancez pas le transfert.',
        };
    }

    // 5. Finaliser les deux traces.
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
             SET status = 'Completed',
                 btc_tx_hash = $2
             WHERE id = $1`,
            [transactionId, txHash]
        );

        await finalClient.query('COMMIT');
    } catch (error) {
        try {
            await finalClient.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[USDT] Échec du rollback final :', rollbackError);
        }

        console.error('[USDT] TXID à réconcilier :', {
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
                'Les USDT ont été envoyés, mais la finalisation comptable ' +
                'doit être réconciliée. Ne relancez pas le transfert.',
        };
    } finally {
        finalClient.release();
    }

    // 6. Les notifications ne doivent pas modifier le résultat comptable.
    try {
        await createNotification(
            userId,
            `Transfert USDT de ${amount} USDT`,
            `Transfert USDT effectué. Frais : ${feeAmount} USDT. Réf. : ${referenceCode}.`,
            'new_message',
            {
                transactionId,
                txHash,
                withdrawalId,
                currency: 'USDT',
                network: 'TRC20',
                amount,
                fee: feeAmount,
                recipientAddress,
            }
        );
    } catch (error) {
        console.error('[USDT] Notification interne non envoyée :', error);
    }

    try {
        const notificationUser = await getUserFromDb({ userId });

        if (notificationUser) {
            await sendTransactionNotifications(notificationUser, {
                description: 'Transfert USDT externe (TRC-20)',
                amount,
                currency: 'USDT',
                fee: feeAmount,
                reference: referenceCode,
                newBalance,
                typeCode: 'WD_CRYPTO_MONEY',
            });
        }
    } catch (error) {
        console.error('[USDT] Notification externe non envoyée :', error);
    }

    return {
        success: true,
        status: 'completed',
        userId,
        walletId: user.id_wallet,
        recipientAddress,
        amount,
        currency: 'USDT',
        network: 'TRC20',
        fee: feeAmount,
        totalDebit,
        txHash,
        withdrawalId,
        transactionId,
        reference: referenceCode,
    };
}
