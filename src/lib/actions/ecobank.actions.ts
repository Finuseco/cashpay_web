
'use server';

import type { User } from '@/lib/types';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';
import { generateXpressCashToken as generateTokenService, sendToEcobankAccount as sendToAccountService, cancelXpressCashToken as cancelTokenService, sendRapidtransfer } from '@/services/ecobank';
import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { PoolClient } from 'pg';
import { countryToCode } from '../utils';

interface AtmTokenArgs {
    user: User;
    pin: string;
    amount: number;
    currency: 'USD' | 'CDF';
    recipientPhone: string;
    recipientName: string;
}

export async function generateEcobankAtmToken(args: AtmTokenArgs): Promise<{ success: boolean; code?: string; error?: string }> {
    const { user, pin, ...withdrawalData } = args;
    const { amount, currency } = withdrawalData;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const transactionResult = await createTransaction({
            user,
            typeCode: `WD_ATM_${currency}`,
            amount: amount,
            currency,
            description: `Génération de code de retrait GAB Ecobank pour ${withdrawalData.recipientPhone}`,
            metadata: { provider: 'ecobank', ...withdrawalData },
            connection,
        });

        if (!transactionResult.success || !transactionResult.transactionId) {
            throw new Error(transactionResult.error || "La transaction a échoué.");
        }

        const ecobankResult = await generateTokenService({
            ...withdrawalData,
            reference: transactionResult.reference!,
            countryCode: countryToCode(user.country)!,
        });
        
        if (ecobankResult.success && ecobankResult.data?.token) {
            // Update transaction with the token from Ecobank
            await connection.query(
                `UPDATE transactions 
                 SET metadata = metadata || jsonb_build_object('xpressCashToken', $1, 'providerTransactionId', $2) 
                 WHERE id = $3`,
                [ecobankResult.data.token, ecobankResult.data.requestId, transactionResult.transactionId]
            );

            await connection.query('COMMIT');
            return { success: true, code: ecobankResult.data.token };
        } else {
            // If Ecobank call fails, we rollback the whole transaction
            throw new Error(ecobankResult.error || "Échec de la génération du jeton Xpress Cash.");
        }
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'generating Ecobank ATM token');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}


interface PayoutArgs {
    user: User;
    pin: string;
    amount: number;
    currency: 'USD' | 'CDF' | 'EUR';
    accountNumber: string;
    recipientName: string;
    destinationCountry: string;
}

export async function processEcobankPayout(args: PayoutArgs) {
     const { user, pin, ...payoutData } = args;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }
    
    const transactionResult = await createTransaction({
        user,
        typeCode: 'WD_VIREMENT_BANKS_FEES',
        amount: payoutData.amount,
        currency: payoutData.currency,
        description: `Virement vers le compte Ecobank ${payoutData.accountNumber}`,
        metadata: { provider: 'ecobank', ...payoutData }
    });
    
    if (!transactionResult.success || !transactionResult.reference) {
        return { success: false, error: transactionResult.error };
    }
    
    const ecobankResult = await sendToAccountService({ ...payoutData, reference: transactionResult.reference });
    
    if (ecobankResult.success && ecobankResult.transactionId) {
         return { success: true, transactionId: ecobankResult.transactionId };
    } else {
         // TODO: Reversal logic
         return { success: false, error: ecobankResult.error || "Le virement vers le compte Ecobank a échoué." };
    }
}

export async function cancelEcobankAtmToken(
    userId: number,
    token: string,
    reason: string
): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Find the transaction associated with this token
        const { rows: txRows } = await connection.query(
            "SELECT * FROM transactions WHERE metadata->>'xpressCashToken' = $1 AND sender_id = $2 FOR UPDATE",
            [token, userId]
        );

        if (txRows.length === 0) {
            throw new Error("Transaction originale pour ce token non trouvée ou non autorisée.");
        }
        const originalTx = txRows[0];

        if (originalTx.status !== 'Completed') {
             throw new Error(`Le token ne peut être annulé car la transaction associée n'est pas complétée (statut: ${originalTx.status}).`);
        }

        // 2. Call the Ecobank API to cancel the token
        const cancelResult = await cancelTokenService({ token, reason });
        if (!cancelResult.success) {
            throw new Error(cancelResult.error || "L'annulation auprès d'Ecobank a échoué.");
        }

        // 3. Reverse the original transaction to refund the user
        const reversalAmount = parseFloat(originalTx.amount) + parseFloat(originalTx.fee || 0);
        const currency = originalTx.currency;
        await connection.query(
            `UPDATE wallets SET balances = jsonb_set(
                COALESCE(balances, '{}'::jsonb),
                '{${currency}}',
                (COALESCE((balances->>'${currency}')::numeric, 0) + $1)::text::jsonb
            ) WHERE user_id = $2`,
            [reversalAmount, userId]
        );

        // 4. Mark the original transaction as 'Reversed' and log the cancellation
        await connection.query(
            `UPDATE transactions 
             SET status = 'Reversed', metadata = metadata || jsonb_build_object('cancellationReason', $1, 'cancellationDate', NOW())
             WHERE id = $2`,
            [reason, originalTx.id]
        );

        await connection.query('COMMIT');
        
        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'cancelling Ecobank ATM token');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}


interface RapidtransferProcessArgs {
    user: User;
    pin: string;
    amount: number;
    currency: 'USD' | 'EUR' | 'CDF';
    accountNumber: string;
    recipientName: string;
    destinationCountry: string;
    destinationBankCode: string;
    purpose?: string;
}

export async function processRapidtransfer(args: RapidtransferProcessArgs) {
     const { user, pin, ...payoutData } = args;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }
    
    const transactionResult = await createTransaction({
        user,
        typeCode: 'WD_VIREMENT_BANKS_FEES',
        amount: payoutData.amount,
        currency: payoutData.currency,
        description: `Rapidtransfer vers ${payoutData.recipientName} (${payoutData.destinationBankCode})`,
        metadata: { provider: 'ecobank_rapidtransfer', ...payoutData }
    });
    
    if (!transactionResult.success || !transactionResult.reference) {
        return { success: false, error: transactionResult.error };
    }
    
    const rapidtransferResult = await sendRapidtransfer({ ...payoutData, reference: transactionResult.reference });
    
    if (rapidtransferResult.success && rapidtransferResult.transactionId) {
         return { success: true, transactionId: rapidtransferResult.transactionId };
    } else {
         // TODO: Reversal logic
         return { success: false, error: rapidtransferResult.error || "Le virement Rapidtransfer a échoué." };
    }
}
