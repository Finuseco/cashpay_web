
'use server';

import { db } from '@/lib/db';

const DEFAULT_FEE_PERCENTAGE = 0.02; // 2% default fee if no specific rule is found
const MIN_FEE = 0.50; // Minimum fee in USD
const MAX_FEE = 10.00; // Maximum fee in USD

// This function would ideally get exchange rates from a reliable source
async function getExchangeRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;
    // In a real app, use an API like Fixer, Open Exchange Rates, etc.
    // For this example, we'll use static rates.
    const rates: Record<string, number> = {
        'USD-CDF': 2800,
        'CDF-USD': 1 / 2800,
        // Add other common rates
    };
    return rates[`${from}-${to}`] || 1; 
}

export async function getFee(args: { 
    amount: number; 
    currency: string; 
    country: string; 
    type: 'DEPOSIT' | 'WITHDRAWAL'; 
    method: string; 
}): Promise<{ success: boolean; fee?: number; total?: number; error?: string }> {
    const { amount, currency, type, method, country } = args;

    if (amount <= 0) {
        return { success: false, error: "Amount must be positive." };
    }

    try {
        const client = await db.getConnection();
        // Find a matching fee rule
        const { rows } = await client.query(
            `SELECT * FROM fee_rules 
             WHERE type = $1 AND method = $2 AND (country = $3 OR country IS NULL) 
             ORDER BY country DESC NULLS LAST, priority DESC 
             LIMIT 1`,
            [type, method, country]
        );

        let feePercentage = DEFAULT_FEE_PERCENTAGE;
        let minFeeLocal = MIN_FEE;
        let maxFeeLocal = MAX_FEE;
        
        const rule = rows[0];
        if (rule) {
            feePercentage = parseFloat(rule.percentage);
            const rate = await getExchangeRate('USD', currency);
            minFeeLocal = rule.min_fee ? parseFloat(rule.min_fee) * rate : MIN_FEE * rate;
            maxFeeLocal = rule.max_fee ? parseFloat(rule.max_fee) * rate : MAX_FEE * rate;
        }

        let calculatedFee = amount * feePercentage;
        calculatedFee = Math.max(calculatedFee, minFeeLocal);
        calculatedFee = Math.min(calculatedFee, maxFeeLocal);

        const total = amount + calculatedFee;

        return {
            success: true,
            fee: parseFloat(calculatedFee.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
        };

    } catch (error) {
        console.error("Error fetching fee:", error);
        // Fallback to default fee calculation in case of DB error
        const defaultFee = Math.min(Math.max(amount * DEFAULT_FEE_PERCENTAGE, MIN_FEE), MAX_FEE);
        return {
            success: true,
            fee: parseFloat(defaultFee.toFixed(2)),
            total: parseFloat((amount + defaultFee).toFixed(2)),
        };
    }
}
