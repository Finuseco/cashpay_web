
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { countryToCode } from '../utils';
import { getAuthenticatedUser } from './user.actions';

export interface ExchangeRate {
    country_code: string;
    from_currency: string;
    to_currency: string;
    rate: number;
}

/**
 * Fetches all available exchange rates from the database for a specific country.
 * If no rates are found for the specific country, it returns an empty array.
 * @param countryIdentifier The name or code of the country.
 * @returns A promise that resolves to an array of exchange rates for that country.
 */
export async function getExchangeRatesForCountry(countryIdentifier?: string | null): Promise<ExchangeRate[]> {
    const countryCode = countryToCode(countryIdentifier); 
    
    if (!countryCode) {
        console.warn(`[Exchange Action] No valid countryIdentifier provided. Returning empty rates.`);
        return [];
    }
    
    try {
        const { rows } = await db.query(
            'SELECT country_code, from_currency, to_currency, rate FROM exchange_rates WHERE country_code = $1',
            [countryCode]
        );

        if (rows.length === 0) {
            console.warn(`[Exchange Action] No rates found for country code: ${countryCode}.`);
            return [];
        }

        return rows.map(row => ({
            country_code: row.country_code,
            from_currency: row.from_currency,
            to_currency: row.to_currency,
            rate: parseFloat(row.rate)
        }));
    } catch (error) {
        handleDbError(error, `fetching exchange rates for ${countryCode}`);
        return [];
    }
}

/**
 * Gets a guaranteed FX quote by fetching the rate from the database based on the user's country.
 * @param amount - The amount in the source currency.
 * @param fromCurrency - The source currency code.
 * @param toCurrency - The destination currency code.
 * @returns A promise that resolves with the quote details.
 */
export async function getGuaranteedFxQuote(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ success: boolean; quote?: { quoteId: string; toAmount: number; rate: number }; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: 'User not authenticated.' };
    }

    const userCountryCode = countryToCode(user.country);
    if (!userCountryCode) {
        return { success: false, error: 'User country not set.' };
    }
    
    // Fetch rates specifically for the user's country from the DB
    const ratesForCountry = await getExchangeRatesForCountry(userCountryCode);

    const specificRate = ratesForCountry.find(
        (r) => r.from_currency === fromCurrency && r.to_currency === toCurrency
    );

    if (!specificRate) {
        return { success: false, error: `Le taux de change de ${fromCurrency} à ${toCurrency} n'est pas disponible pour votre région.` };
    }
    
    const rate = specificRate.rate;
    const toAmount = amount * rate;
    const quoteId = `fx_quote_${Date.now()}`;

    return {
      success: true,
      quote: {
        quoteId,
        toAmount,
        rate,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Une erreur est survenue lors de la récupération du devis.' };
  }
}
