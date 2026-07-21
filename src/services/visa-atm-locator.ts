
'use server';

/**
 * @fileoverview A mock service for interacting with the Visa ATM Locator API.
 * This simulates finding nearby ATMs.
 */

const API_BASE_URL = 'https://sandbox.api.visa.com';

interface Location {
    latitude: number;
    longitude: number;
}

interface AtmSearchOptions {
    distance?: number;
    distanceUnit?: 'KM' | 'MI';
}

interface AtmLocation {
    name: string;
    address: string;
    distance: number;
    distanceUnit: 'KM' | 'MI';
    is24Hour: boolean;
    isDepositAvailable: boolean;
}

interface AtmLocatorResponse {
    success: boolean;
    data?: {
        foundAtmCount: number;
        results: AtmLocation[];
    };
    error?: string;
}

const checkApiCredentials = (): boolean => {
    const userId = process.env.VISA_ATM_API_USERID;
    const password = process.env.VISA_ATM_API_PASSWORD;

    if (!userId || !password || userId.includes('YOUR_VISA') || password.includes('YOUR_VISA')) {
        console.warn("[Visa ATM Locator] API credentials are not configured. Using mock data.");
        return false;
    }
    return true;
}

/**
 * Simulates a call to the Visa ATM Locator API to find nearby ATMs.
 * @param location The user's latitude and longitude.
 * @param options Additional search options.
 * @returns A promise that resolves with the search results.
 */
export async function locateAtms(location: Location, options: AtmSearchOptions = {}): Promise<AtmLocatorResponse> {
    console.log(`[Visa ATM Locator] Searching for ATMs near`, location, "with options:", options);
    const hasCredentials = checkApiCredentials();

    if (hasCredentials) {
        // In a real application, you would make an actual API call here.
        // const payload = { ... };
        // const response = await fetch(`${API_BASE_URL}/globalatmlocator/v3/localatms/totalsinquiry`, { ... });
        // const data = await response.json();
        // ... handle real response
    }

    // Since we don't have real credentials, we return mock data.
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay

    const mockResults: AtmLocation[] = [
        { name: "Rawbank Gombe", address: "123 Av. de la Justice, Gombe, Kinshasa", distance: 0.5, distanceUnit: "KM", is24Hour: true, isDepositAvailable: true },
        { name: "EquityBCDC ATM", address: "456 Blvd du 30 Juin, Gombe, Kinshasa", distance: 1.2, distanceUnit: "KM", is24Hour: true, isDepositAvailable: false },
        { name: "TMB ATM", address: "789 Av. des Aviateurs, Gombe, Kinshasa", distance: 2.1, distanceUnit: "KM", is24Hour: false, isDepositAvailable: true },
    ];

    return {
        success: true,
        data: {
            foundAtmCount: mockResults.length,
            results: mockResults
        }
    };
}
