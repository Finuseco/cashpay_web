'use server';
import { db } from '@/lib/db';
import { countryToCode } from '@/lib/utils';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { GLOBAL_FEE_TYPES, MOBILE_MONEY_WD_TYPES } from '@/lib/fee-policy';
export interface FeeTier { min: number; max: number; fee: string }
export interface FeeStructure { transaction_type: string; currency: string; country_code: string; fee_tiers: FeeTier[] }
function parseRows(rows: any[]): FeeStructure[] {
    return rows.map(row => {
        const raw = typeof row.fee_tiers === 'string' ? JSON.parse(row.fee_tiers) : row.fee_tiers;
        if (!Array.isArray(raw)) throw new Error(`Grille tarifaire invalide : ${row.transaction_type}/${row.currency}.`);
        const tiers = raw.map(tier => {
            const min = Number(tier.min), max = Number(tier.max), fee = String(tier.fee).trim();
            if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || (max !== 0 && max < min) || !/^\d+(?:\.\d+)?%?$/.test(fee)) throw new Error(`Palier tarifaire invalide : ${row.transaction_type}/${row.currency}.`);
            return { min, max, fee };
        });
        return { transaction_type: row.transaction_type, currency: row.currency, country_code: row.country_code, fee_tiers: tiers };
    });
}
export async function getFeeStructuresForCountry(country: string): Promise<Record<string, FeeStructure[]>> {
    const code = country === 'GBL' ? 'GBL' : countryToCode(country);
    if (!code) throw new Error('Pays tarifaire invalide.');
    const { rows } = await db.query('SELECT transaction_type, currency, country_code, fee_tiers FROM fee_structures WHERE country_code = $1 AND is_active = TRUE ORDER BY transaction_type, currency', [code]);
    return parseRows(rows).reduce((result, row) => { (result[row.transaction_type] ||= []).push(row); return result; }, {} as Record<string, FeeStructure[]>);
}
export async function getEffectiveFeeSchedule(): Promise<{ countryCode: string; fees: Record<string, FeeStructure[]> }> {
    const user = await getAuthenticatedUser();
    if (!user) throw new Error('Connectez-vous pour consulter vos frais.');
    const code = countryToCode(user.country) || 'GBL';
    const { rows } = await db.query('SELECT transaction_type, currency, country_code, fee_tiers FROM fee_structures WHERE country_code = ANY($1::text[]) AND is_active = TRUE ORDER BY transaction_type, currency', [[...new Set([code, 'GBL', 'CD'])]]);
    const rules = parseRows(rows), fees: Record<string, FeeStructure[]> = {};
    const pairs = new Set(rules.map(rule => `${rule.transaction_type}:${rule.currency}`));
    for (const pair of pairs) {
        const [type, currency] = pair.split(':');
        const globalOnly = GLOBAL_FEE_TYPES.includes(type) || (type === 'TICKET_BUY' && ['USD', 'EUR'].includes(currency));
        const primary = globalOnly ? 'GBL' : code;
        const rule = rules.find(row => row.transaction_type === type && row.currency === currency && row.country_code === primary)
            || rules.find(row => row.transaction_type === type && row.currency === currency && row.country_code === 'GBL')
            || (MOBILE_MONEY_WD_TYPES.includes(type) && ['USD', 'EUR'].includes(currency) ? rules.find(row => row.transaction_type === type && row.currency === currency && row.country_code === 'CD') : undefined);
        if (rule) (fees[type] ||= []).push(rule);
    }
    return { countryCode: code, fees };
}
export async function getFee(args: { amount: number; currency: string; country: string; type: 'DEPOSIT' | 'WITHDRAWAL'; method: string }): Promise<{ success: boolean; fee?: number; total?: number; error?: string }> {
    try {
        if (!Number.isFinite(args.amount) || args.amount <= 0) throw new Error('Montant invalide.');
        const { fees } = await getEffectiveFeeSchedule();
        const method = args.method.toUpperCase().replace(/[ -]/g, '_');
        const type = args.type === 'DEPOSIT' ? 'DP_GENERAL_FEES' : method.startsWith('WD') ? method : `WD_${method}`;
        const structure = fees[type]?.find(rule => rule.currency === args.currency.toUpperCase());
        const tier = structure?.fee_tiers.find(tier => args.amount >= tier.min && (tier.max === 0 || args.amount <= tier.max));
        if (!tier) throw new Error('Aucun tarif configuré pour cette opération.');
        const fee = tier.fee.endsWith('%') ? args.amount * Number.parseFloat(tier.fee) / 100 : Number(tier.fee);
        return { success: true, fee, total: args.amount + fee };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Tarif indisponible.' }; }
}
