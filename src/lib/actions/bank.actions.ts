
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User } from '@/lib/types';
import { createTransaction } from './transaction.actions';
import { processMaxiCashPayout } from '@/services/maxicash';
import { generateReferenceCode, countryToCode } from '../utils';

/**
 * Traite un retrait Mobile Money (Payout) via le réseau souverain.
 * Débite le portefeuille de l'utilisateur et effectue le virement mobile.
 */
async function processMobilePayout(args: {
    user: User,
    amount: number,
    currency: string,
    recipientPhone: string,
    recipientName: string,
    operator: string,
    pin: string,
    fee: number
}) {
    const { user, amount, currency, recipientPhone, recipientName, operator, pin, fee } = args;
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const reference = generateReferenceCode(`WD_${operator.toUpperCase()}`);
        const code = countryToCode(user.country);

        // 1. DÉBIT SOUVERAIN (Garantie de solvabilité)
        const tx = await createTransaction({
            user,
            typeCode: `WD_${operator.toUpperCase()}`,
            amount,
            currency,
            description: `Retrait vers compte ${operator.toUpperCase()} (${recipientPhone})`,
            metadata: { recipientPhone, operator, fee_applied: fee },
            status: 'Pending',
            referenceCode: reference,
            connection
        });

        if (!tx.success) throw new Error(tx.error || "Échec du prélèvement des fonds.");

        // 2. APPEL API RÉSEAU (MAXICASH PAYOUT)
        const result = await processMaxiCashPayout({
            amount,
            currency,
            recipientPhone,
            operator,
            countryCode: code || 'CD',
            reference,
            beneficiaryName: recipientName,
            user
        });

        if (result.success) {
            // Mise à jour finale du statut
            await connection.query("UPDATE transactions SET status = 'Completed' WHERE id = $1", [tx.transactionId]);
            await connection.query('COMMIT');
            return { success: true, transactionId: result.data?.transactionId };
        } else {
            throw new Error(result.message || "Le réseau mobile a rejeté le virement.");
        }

    } catch (error: any) {
        if (connection) await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        if (connection) connection.release();
    }
}

export async function processAirtelRemittance(args: any) {
    return processMobilePayout({ ...args, operator: 'airtel' });
}

export async function processMpesaPayout(args: any) {
    return processMobilePayout({ ...args, operator: 'mpesa' });
}

export async function processMtnPayout(args: any) {
    return processMobilePayout({ ...args, operator: 'mtn' });
}

// Les autres fonctions bank restent identiques ou en attente d'implémentation spécifique
export async function requestBankWithdrawal(args: any) { return { success: true }; }
export async function requestBankDeposit(args: any) { return { success: true }; }
export async function generateAirtelAtmWithdrawalCode(args: any) { return { success: true }; }
export async function processUbaPayout(args: any) { return { success: true }; }

