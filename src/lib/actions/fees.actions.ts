

'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';

export interface FeeTier {
    fee: string;
    max: number;
    min: number;
}

export interface FeeStructure {
    country_code: string;
    transaction_type: 'withdrawal' | 'transfer';
    currency: 'USD' | 'EUR' | string; // Allow local currency codes
    fee_tiers: FeeTier[];
}

export async function getFeeStructuresForCountry(countryCode: string): Promise<Record<string, FeeStructure[]>> {
    try {
        const { rows } = await db.query(
            'SELECT country_code, transaction_type, currency, fee_tiers FROM fee_structures WHERE country_code = $1 AND is_active = true',
            [countryCode]
        );
        
        const structures: Record<string, FeeStructure[]> = {};

        rows.forEach(row => {
            const transactionType = row.transaction_type;
            if (!structures[transactionType]) {
                structures[transactionType] = [];
            }
            structures[transactionType].push({
                country_code: row.country_code,
                transaction_type: transactionType,
                currency: row.currency,
                fee_tiers: typeof row.fee_tiers === 'string' ? JSON.parse(row.fee_tiers) : row.fee_tiers,
            });
        });
        return structures;
    } catch (error) {
        handleDbError(error, 'fetching fee structures for country');
        return {};
    }
}
