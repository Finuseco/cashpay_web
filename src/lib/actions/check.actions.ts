
      
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User, DigitalCheck } from '@/lib/types';
import { createTransaction } from './transaction.actions';
import { format } from 'date-fns';
import type { PoolClient } from 'pg';


interface CreateCheckArgs {
    user: User;
    recipientName: string;
    amount: number;
    currency: string;
    issueDate: Date;
}

export async function createDigitalCheck(args: CreateCheckArgs): Promise<{ success: boolean; error?: string, check?: DigitalCheck }> {
    const { user, recipientName, amount, currency, issueDate } = args;

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // Debit the user's wallet
        const transactionResult = await createTransaction({
            user,
            typeCode: 'CH_ISSUE', // This type needs to be added to transaction_types
            amount: amount,
            currency: currency,
            description: `Émission du chèque pour ${recipientName}`,
            metadata: { recipientName },
            connection
        });

        if (!transactionResult.success) {
            await connection.query('ROLLBACK');
            return { success: false, error: transactionResult.error || "Le paiement pour le chèque a échoué." };
        }
        
        const checkNumber = `CP-CHK-${Date.now()}`;
        const newCheck = {
            check_number: checkNumber,
            issuer_user_id: user.id,
            recipient_name: recipientName,
            amount,
            currency,
            issue_date: format(issueDate, 'yyyy-MM-dd'),
            status: 'valid'
        };

        const { rows } = await connection.query('INSERT INTO digital_checks (check_number, issuer_user_id, recipient_name, amount, currency, issue_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', Object.values(newCheck));
        const newCheckId = rows[0].id;

        await connection.query('COMMIT');
        
        const createdCheck: DigitalCheck = {
            id: newCheckId,
            checkNumber,
            issuerUserId: user.id,
            recipientName,
            amount,
            currency,
            issueDate: format(issueDate, 'yyyy-MM-dd'),
            status: 'valid'
        };

        return { success: true, check: createdCheck };
    } catch (error) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'creating digital check');
        return { success: false, error: dbError.error };
    } finally {
        connection.release();
    }
}

export async function getDigitalChecksForUser(userId: number): Promise<DigitalCheck[]> {
    try {
        const { rows } = await db.query(
            `SELECT * FROM digital_checks WHERE issuer_user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return rows.map(row => ({
            id: row.id,
            checkNumber: row.check_number,
            issuerUserId: row.issuer_user_id,
            recipientName: row.recipient_name,
            amount: parseFloat(row.amount),
            currency: row.currency,
            issueDate: format(new Date(row.issue_date), 'yyyy-MM-dd'),
            status: row.status,
            cashingDate: row.cashing_date ? format(new Date(row.cashing_date), 'yyyy-MM-dd') : undefined,
        }));
    } catch (error) {
        handleDbError(error, 'fetching digital checks');
        return [];
    }
}

    