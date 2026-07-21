

'use server';

import type { User } from '@/lib/types';
import { db } from '../db';
import { handleDbError } from './helpers';
import { getAuthenticatedUser } from './user.actions';
import { createTransaction } from './transaction.actions';
import { format } from 'date-fns';
import type { PoolClient } from 'pg';

interface RequestBankStatementArgs {
    startDate: Date;
    endDate: Date;
    fee: number;
}

export async function requestBankStatement(args: RequestBankStatementArgs): Promise<{ success: boolean; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: 'Utilisateur non authentifié.' };
    }

    const { startDate, endDate, fee } = args;

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const transactionResult = await createTransaction({
            user,
            typeCode: 'FE',
            amount: fee,
            currency: 'USD',
            description: `Frais pour relevé bancaire du ${format(startDate, 'dd/MM/yy')} au ${format(endDate, 'yyyy/MM/dd')}`,
            metadata: {
                startDate: format(startDate, 'yyyy-MM-dd'),
                endDate: format(endDate, 'yyyy-MM-dd'),
            },
            connection
        });

        if (!transactionResult.success) {
            await connection.query('ROLLBACK');
            return { success: false, error: transactionResult.error || "Le paiement des frais a échoué." };
        }
        
        await connection.query('COMMIT');

        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'requesting bank statement');
        return { success: false, error: dbError.error || "Une erreur inconnue est survenue." };
    } finally {
        connection.release();
    }
}
