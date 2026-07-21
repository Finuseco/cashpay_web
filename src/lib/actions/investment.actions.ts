

'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User, Investment } from '@/lib/types';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';
import { format } from 'date-fns';
import type { PoolClient } from 'pg';

interface CreateInvestmentArgs {
    user: User;
    amount: number;
    currency: string;
    duration: number; // in months
    pin: string;
}

export async function createInvestment(args: CreateInvestmentArgs): Promise<{ success: boolean; error?: string }> {
    const { user, amount, currency, duration, pin } = args;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const transactionResult = await createTransaction({
            user,
            typeCode: 'DAT_SUBMIT',
            amount: amount,
            currency: currency,
            description: `Souscription Dépôt à Terme de ${duration} mois.`,
            metadata: { duration_months: duration },
            connection
        });

        if (!transactionResult.success || !transactionResult.transactionId) {
            throw new Error(transactionResult.error || "Le débit pour le dépôt à terme a échoué.");
        }

        const interestRate = 0.0366; // 3.66% per month
        const totalReturn = amount * (1 + (interestRate * duration));

        const newInvestment = {
            user_id: user.id,
            amount,
            currency,
            duration_months: duration,
            interest_rate: interestRate,
            total_return: totalReturn,
            status: 'pending',
            source_transaction_id: transactionResult.transactionId,
        };

        await connection.query('INSERT INTO term_deposits (user_id, amount, currency, duration_months, interest_rate, total_return, status, source_transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', Object.values(newInvestment));
        
        await connection.query('COMMIT');

        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'creating investment');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

export async function getInvestmentsForUser(userId: number): Promise<Investment[]> {
    try {
        const { rows } = await db.query('SELECT * FROM term_deposits WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return rows.map(row => ({
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            duration: row.duration_months,
            interest_rate: parseFloat(row.interest_rate),
            total_return: parseFloat(row.total_return),
            status: row.status,
            start_date: row.approved_at ? format(new Date(row.approved_at), 'yyyy-MM-dd') : null,
            maturity_date: row.maturity_date ? format(new Date(row.maturity_date), 'yyyy-MM-dd') : null,
            created_at: new Date(row.created_at).toISOString(),
        }));
    } catch (error) {
        handleDbError(error, 'fetching investments for user');
        return [];
    }
}


export async function processDatRejection(datId: number, adminNotes: string): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: datRows } = await connection.query('SELECT * FROM term_deposits WHERE id = $1 AND status = $2', [datId, 'pending']);
        if (datRows.length === 0) {
            throw new Error('Dépôt à terme non trouvé ou déjà traité.');
        }
        const dat = datRows[0];

        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [dat.user_id]);
        if (userRows.length === 0) {
            throw new Error('Utilisateur associé au dépôt non trouvé.');
        }
        const user: User = userRows[0] as User;

        // Credit the user's wallet back
        const refundResult = await createTransaction({
            user: user,
            typeCode: 'DP', // Standard Deposit to credit account
            amount: parseFloat(dat.amount),
            currency: dat.currency,
            description: `Remboursement du dépôt à terme rejeté #${datId}`,
            metadata: { original_dat_id: datId, rejection_reason: adminNotes },
            connection,
        });

        if (!refundResult.success) {
            throw new Error(refundResult.error || "Le remboursement du dépôt a échoué.");
        }

        // Update the DAT status to 'rejected'
        await connection.query('UPDATE term_deposits SET status = $1 WHERE id = $2', ['rejected', datId]);

        await connection.query('COMMIT');

        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'processing DAT rejection');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}
