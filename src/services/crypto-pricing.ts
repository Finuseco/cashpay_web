
'use server';

/**
 * @fileoverview A service for fetching live cryptocurrency prices.
 * This service simulates calls to a real-time market data provider like CoinGecko.
 */

interface CryptoPriceResponse {
    success: boolean;
    price?: number;
    error?: string;
}

// Predefined mock base rates for consistent but realistic testing
const MOCK_BASE_RATES: Record<string, number> = {
    'BTC': 61500.00,
    'ETH': 3100.00,
    'USDT_ERC20': 1.00,
    'USDT_TRC20': 1.00,
    'AFC': 0.15, // Initial mock price for AfriCoin
};

/**
 * Simulates a call to an external API (like CoinGecko) to get the current price 
 * of a cryptocurrency in a given fiat currency.
 * 
 * @param cryptoSymbol The symbol of the cryptocurrency (e.g., 'BTC', 'ETH').
 * @param fiatSymbol The symbol of the fiat currency (e.g., 'USD').
 * @returns A promise that resolves with the price information.
 */
export async function getLiveCryptoPrice(cryptoSymbol: string, fiatSymbol: string): Promise<CryptoPriceResponse> {
    console.log(`[Crypto Pricing] Fetching live price for ${cryptoSymbol}/${fiatSymbol}...`);
    
    // In a real application, you would make an API call here.
    // Example with CoinGecko:
    // const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoSymbol.toLowerCase()}&vs_currencies=${fiatSymbol.toLowerCase()}`;
    // const response = await fetch(url);
    // const data = await response.json();
    // const price = data[cryptoSymbol.toLowerCase()][fiatSymbol.toLowerCase()];

    // For now, we use a mock implementation based on your specifications.
    
    if (fiatSymbol !== 'USD') {
        const errorMsg = `Mock API only supports conversion to USD, but got ${fiatSymbol}.`;
        console.error(`[Crypto Pricing] ${errorMsg}`);
        return { success: false, error: errorMsg };
    }

    const baseRate = MOCK_BASE_RATES[cryptoSymbol];
    if (baseRate === undefined) {
        const errorMsg = `Mock API does not have a rate for ${cryptoSymbol}.`;
        console.error(`[Crypto Pricing] ${errorMsg}`);
        return { success: false, error: errorMsg };
    }

    // Simulate small market fluctuations by adding a random percentage (+/- 0.5%)
    const fluctuation = (Math.random() - 0.5) * 0.01; // Between -0.5% and +0.5%
    const livePrice = baseRate * (1 + fluctuation);

    // Simulate a network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100)); // Delay between 100ms and 500ms
    
    console.log(`[Crypto Pricing] Live price for ${cryptoSymbol}: ${livePrice.toFixed(2)} ${fiatSymbol}`);

    return {
        success: true,
        price: livePrice
    };
}
