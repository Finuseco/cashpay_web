

'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { Currency, User } from '@/lib/types';
import { getAuthenticatedUser } from './user.actions';
import { countries } from '../countries';
import { countryToCode } from '../utils';

// This defines the core currencies available in the system
const defaultCurrencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
];

async function getLocalCurrency(user: User | null): Promise<Currency | null> {
    if (!user || !user.country) return null;
    
    const userCountryCode = countryToCode(user.country);
    if (!userCountryCode) return null;
    
    const countryInfo = countries.find(c => c.code === userCountryCode);
    if (!countryInfo || !countryInfo.currency_code) return null;

    return {
        code: countryInfo.currency_code,
        name: countryInfo.currency_name,
        symbol: countryInfo.currency_symbol,
        balance: '0.00', // This will be updated later
    };
}

export async function getUserCurrencies(userId: number): Promise<Currency[]> {
    const user = await getAuthenticatedUser(); // This gets the full user object
    const localCurrency = await getLocalCurrency(user);

    try {
        const { rows } = await db.query('SELECT balances FROM wallets WHERE user_id = $1', [userId]);

        let balances: { [key: string]: number } = { USD: 0, EUR: 0 };
        if (localCurrency) {
            balances[localCurrency.code] = 0;
        }

        if (rows.length > 0 && rows[0].balances) {
            const dbBalances = typeof rows[0].balances === 'string'
                ? JSON.parse(rows[0].balances)
                : rows[0].balances;
            
            balances = { ...balances, ...dbBalances };
        }

        const currencyMap = new Map<string, Currency>();
        
        // Add default currencies first
        defaultCurrencies.forEach(c => {
             const balanceValue = parseFloat(String(balances[c.code] || '0').replace(/,/g, ''));
             currencyMap.set(c.code, {
                ...c,
                balance: balanceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            });
        });
        
        // Add local currency if it exists and is not one of the defaults
        if (localCurrency && !currencyMap.has(localCurrency.code)) {
             const balanceValue = parseFloat(String(balances[localCurrency.code] || '0').replace(/,/g, ''));
             currencyMap.set(localCurrency.code, {
                ...localCurrency,
                balance: balanceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            });
        }
        
        const allCurrencies = Array.from(currencyMap.values());
        
        // Sort to ensure a consistent order: Local, then USD, then EUR.
        allCurrencies.sort((a, b) => {
            if (a.code === localCurrency?.code) return -1;
            if (b.code === localCurrency?.code) return 1;
            if (a.code === 'USD') return -1;
            if (b.code === 'USD') return 1;
            if (a.code === 'EUR') return -1;
            if (b.code === 'EUR') return 1;
            return a.code.localeCompare(b.code);
        });

        return allCurrencies;

    } catch (error) {
        handleDbError(error, 'fetching user currencies');
        return defaultCurrencies.map(c => ({ ...c, balance: '0.00' }));
    }
}
