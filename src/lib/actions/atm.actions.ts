
'use server';

import { locateAtms as locateVisaAtms } from '@/services/visa-atm-locator';

interface Location {
    latitude: number;
    longitude: number;
}

interface AtmSearchOptions {
    distance?: number;
    distanceUnit?: 'KM' | 'MI';
    brand?: 'Visa' | 'Mastercard' | 'All';
}

interface AtmLocation {
    name: string;
    address: string;
    distance: number;
    distanceUnit: 'KM' | 'MI';
    is24Hour: boolean;
    isDepositAvailable: boolean;
}

export async function findNearbyAtms(location: Location, options: AtmSearchOptions = {}): Promise<AtmLocation[]> {
    const { brand = 'All' } = options;

    if (brand === 'Visa' || brand === 'All') {
        const visaResult = await locateVisaAtms(location, options);
        if (visaResult.success && visaResult.data?.results) {
            return visaResult.data.results;
        }
    }
    
    return [];
}
