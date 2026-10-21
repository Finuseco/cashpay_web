'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { createTransaction } from './transaction.actions';
import { formatUser } from '../utils';
import type { User } from '../types';

/**
 * Crée un nouvel abonnement (TV, Starlink, etc.)
 */
export async function createSubscription(args: {
    user: User;
    serviceName: string;
    amount: number;
    operatorName: string;
    smartcardNumber: string;
    currency?: string;
    status?: 'active' | 'pending';
    metadata?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // Débiter le compte souverain
        const tx = await createTransaction({
            user: args.user,
            typeCode: 'TV',
            amount: args.amount,
            currency: args.currency || 'USD',
            description: `Abonnement ${args.operatorName} - ${args.serviceName}`,
            metadata: {
                smartcardNumber: args.smartcardNumber,
                operator: args.operatorName,
                ...(args.metadata || {})
            },
            connection
        });

        if (!tx.success) throw new Error(tx.error || "Paiement échoué");

        // Enregistrer l'abonnement
        await connection.query(
            `INSERT INTO subscriptions (user_id, service_name, amount, operator_name, smartcard_number, status, transaction_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                args.user.id,
                args.serviceName,
                args.amount,
                args.operatorName,
                args.smartcardNumber,
                args.status || 'active',
                tx.transactionId
            ]
        );

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        if (connection) await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        if (connection) connection.release();
    }
}
