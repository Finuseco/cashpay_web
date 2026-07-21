

'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { PoolClient } from 'pg';

export type ControlType = 'VELOCITY_LIMIT' | 'ECOMMERCE' | 'POS' | 'ATM' | 'RECURRING' | 'MERCHANT_CATEGORY';
export type ControlWindow = 'TRANSACTION' | 'DAY' | 'WEEK' | 'MONTH' | 'LIFETIME';

export interface TransactionControl {
    id: number;
    card_id: string;
    control_type: ControlType;
    is_blocked: boolean;
    limit_value: number | null;
    window: ControlWindow | null;
    mcc: string | null; // Merchant Category Code
}

/**
 * Fetches all active transaction controls for a given card.
 * @param cardId - The ID of the card.
 * @returns A promise that resolves to an array of transaction controls.
 */
export async function getTransactionControls(cardId: string): Promise<TransactionControl[]> {
    try {
        const { rows } = await db.query(
            'SELECT * FROM card_transaction_controls WHERE card_id = $1',
            [cardId]
        );
        return rows as TransactionControl[];
    } catch (error) {
        handleDbError(error, 'fetching transaction controls');
        return [];
    }
}

/**
 * Updates or creates transaction controls for a card.
 * @param cardId - The ID of the card.
 * @param controls - An array of control objects to update or create.
 * @returns A promise that resolves with the result.
 */
export async function updateTransactionControls(
    cardId: string, 
    controls: Partial<TransactionControl>[]
): Promise<{ success: boolean; controls: TransactionControl[]; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        for (const control of controls) {
            const payload = {
                card_id: cardId,
                control_type: control.control_type,
                is_blocked: control.is_blocked ?? false,
                limit_value: control.limit_value ?? null,
                window: control.window ?? null,
                mcc: control.mcc ?? null,
            };
            
            // Using INSERT ... ON DUPLICATE KEY UPDATE to handle both creation and updates atomically.
            // A unique key on (card_id, control_type, mcc, window) is required for this to work correctly.
            await connection.query(
                `INSERT INTO card_transaction_controls (card_id, control_type, is_blocked, limit_value, window, mcc)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (card_id, control_type) DO UPDATE SET
                   is_blocked = EXCLUDED.is_blocked,
                   limit_value = EXCLUDED.limit_value,
                   window = EXCLUDED.window,
                   mcc = EXCLUDED.mcc`,
                [payload.card_id, payload.control_type, payload.is_blocked, payload.limit_value, payload.window, payload.mcc]
            );
        }

        await connection.query('COMMIT');
        const updatedControls = await getTransactionControls(cardId);
        return { success: true, controls: updatedControls };

    } catch (error) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'updating transaction controls');
        return { success: false, error: dbError.error, controls: [] };
    } finally {
        connection.release();
    }
}
