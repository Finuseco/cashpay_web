
'use server';

/**
 * @fileoverview A mock service for interacting with the Visa Foreign Exchange Rates API.
 * This simulates fetching real-time currency conversion rates.
 * Documentation: https://developer.visa.com/capabilities/foreign_exchange/reference#tag/Foreign-Exchange-Rates-API/operation/ForeignExchangeRates_v2%20-%20Latest
 */

const API_BASE_URL = 'https://sandbox.api.visa.com/forex/v2/foreignexchange';

interface FxRateResponse {
    success: boolean;
    rate?: number;
    error?: string;
}

const checkApiCredentials = (): boolean => {
    const userId = process.env.VISA_FX_API_USERID;
    const password = process.env.VISA_FX_API_PASSWORD;

    if (!userId || !password || userId.includes('YOUR_VISA') || password.includes('YOUR_VISA')) {
        console.warn("[Visa FX Service] API credentials are not configured. Using mock data.");
        return false;
    }
    return true;
}

// Predefined mock rates for consistent testing
const MOCK_RATES: Record<string, Record<string, number>> = {
    'USD': { 'CDF': 2850.50, 'EUR': 0.92, 'USD': 1.0 },
    'EUR': { 'CDF': 3100.75, 'USD': 1.08, 'EUR': 1.0 },
    'CDF': { 'USD': 0.00035, 'EUR': 0.00032, 'CDF': 1.0 },
};

/**
 * Simulates a call to the Visa Foreign Exchange Rates API to get conversion rates.
 * @param sourceCurrency The currency of the amount to be converted.
 * @param destinationCurrency The currency to which the amount is to be converted.
 * @returns A promise that resolves with the conversion rate.
 */
export async function getFxRates(sourceCurrency: string, destinationCurrency: string): Promise<FxRateResponse> {
    console.log(`[Visa FX Service] Fetching rate for ${sourceCurrency} to ${destinationCurrency}`);
    const hasCredentials = checkApiCredentials();

    if (hasCredentials) {
        // In a real application, you would make an actual API call here.
        // const url = `${API_BASE_URL}?sourceCurrency=${sourceCurrency}&destinationCurrency=${destinationCurrency}`;
        // ... handle API call logic
    }
    
    // Simulate API delay and return mock data
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300));
    
    const rate = MOCK_RATES[sourceCurrency]?.[destinationCurrency];

    if (rate) {
        return {
            success: true,
            rate: rate
        };
    } else {
        console.warn(`[Visa FX Service] Mock rate not found for ${sourceCurrency} to ${destinationCurrency}.`);
        return {
            success: false,
            error: `Conversion from ${sourceCurrency} to ${destinationCurrency} is not supported.`
        };
    }
}
