import type { PoolClient } from 'pg';
import type { User } from '@/lib/types';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { countryToCode } from '@/lib/utils';
export async function paymentQuote(connection: PoolClient, user: User, amount: number, currency: string, sourceCurrency: string, type: 'TR' | 'TICKET_BUY') {
    if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3,10}$/.test(currency) || !/^[A-Z]{3,10}$/.test(sourceCurrency)) throw new Error('Montant ou devise invalide.');
    let debit = amount;
    if (amount > 0 && sourceCurrency !== currency) {
        const { rows } = await connection.query('SELECT rate FROM exchange_rates WHERE country_code = $1 AND from_currency = $2 AND to_currency = $3', [countryToCode(user.country) || 'GBL', currency, sourceCurrency]);
        const rate = Number(rows[0]?.rate);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error('Taux de change indisponible.');
        debit *= rate;
    }
    if (!Number.isFinite(debit)) throw new Error('Montant converti invalide.');
    const fee = amount > 0 ? Number(await calculateTransactionFee(debit, sourceCurrency, type, user.country, connection)) : 0;
    if (!Number.isFinite(fee) || fee < 0) throw new Error('Calcul des frais indisponible.');
    const { rows } = await connection.query('SELECT balances FROM wallets WHERE user_id = $1', [user.id]);
    const balances = typeof rows[0]?.balances === 'string' ? JSON.parse(rows[0].balances) : rows[0]?.balances || {};
    const balance = Number(balances[sourceCurrency] || 0);
    return { amount: debit, fee, totalDebit: debit + fee, currency: sourceCurrency, originalAmount: amount, originalCurrency: currency, balance, sufficientBalance: balance >= debit + fee };
}
