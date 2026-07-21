'use server';

/**
 * @fileoverview Service de connexion aux APIs de réservation aérienne (NDC/GDS).
 * Gère les compagnies nationales et internationales (Ethiopian Airlines, CAA, etc.)
 * Documentation standard: Recherche -> Offre -> Réservation -> Ticketing
 */

import config from '@/config';

const API_BASE_URL = 'https://api.airlines-gateway.com/v1'; 
const API_KEY = config.apiKeys.airlinesApiKey;
const API_SECRET = config.apiKeys.airlinesApiSecret;

export interface FlightSearchArgs {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    passengers: number;
    cabin: 'economy' | 'business' | 'first';
}

export interface FlightOffer {
    id: string;
    airlineName: string;
    airlineCode: string;
    airlineLogo: string;
    price: number;
    currency: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    isInternational: boolean;
    stops: number;
    baggageAllowance: string;
}

const checkConfig = () => {
    if (!API_KEY || API_KEY.includes('YOUR_')) {
        console.warn("[Airlines Service] Clés API non configurées. Utilisation du mode simulation.");
        return false;
    }
    return true;
};

/**
 * Recherche des offres de vols en temps réel auprès des agrégateurs.
 */
export async function searchFlights(args: FlightSearchArgs): Promise<{ success: boolean; offers: FlightOffer[]; error?: string }> {
    if (!checkConfig()) {
        await new Promise(r => setTimeout(r, 1200));
        // Simulation de résultats
        const mockOffers: FlightOffer[] = [
            {
                id: 'off_eth_992',
                airlineName: 'Ethiopian Airlines',
                airlineCode: 'ET',
                airlineLogo: 'https://placehold.co/100x40/FFD700/000000?text=ETHIOPIAN',
                price: 520,
                currency: 'USD',
                departureTime: '13:45',
                arrivalTime: '19:20',
                duration: '5h 35m',
                isInternational: true,
                stops: 0,
                baggageAllowance: '2 x 23kg'
            },
            {
                id: 'off_eth_881',
                airlineName: 'Ethiopian Airlines',
                airlineCode: 'ET',
                airlineLogo: 'https://placehold.co/100x40/FFD700/000000?text=ETHIOPIAN',
                price: 840,
                currency: 'USD',
                departureTime: '22:15',
                arrivalTime: '06:00',
                duration: '7h 45m',
                isInternational: true,
                stops: 1,
                baggageAllowance: '2 x 23kg'
            },
            {
                id: 'off_caa_102',
                airlineName: 'CAA (Compagnie Africaine d\'Aviation)',
                airlineCode: 'BU',
                airlineLogo: 'https://placehold.co/100x40/0000FF/FFFFFF?text=CAA',
                price: 195,
                currency: 'USD',
                departureTime: '07:30',
                arrivalTime: '09:00',
                duration: '1h 30m',
                isInternational: false,
                stops: 0,
                baggageAllowance: '1 x 20kg'
            }
        ];
        return { success: true, offers: mockOffers };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/offers/search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(args)
        });
        const data = await response.json();
        return { success: true, offers: data.offers };
    } catch (e) {
        return { success: false, error: "Le service de recherche de vols est temporairement indisponible." };
    }
}

/**
 * Crée une réservation (Order) et émet le billet (Ticketing).
 */
export async function bookFlight(offerId: string, passengers: any[]): Promise<{ success: boolean; pnr?: string; error?: string }> {
    if (!checkConfig()) {
        await new Promise(r => setTimeout(r, 2000));
        return { 
            success: true, 
            pnr: `CP-${Math.random().toString(36).substring(2, 8).toUpperCase()}` 
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${API_KEY}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                offer_id: offerId, 
                passengers,
                type: "instant_ticketing" 
            })
        });
        const data = await response.json();
        
        if (response.ok && data.pnr) {
            return { success: true, pnr: data.pnr };
        } else {
            return { success: false, error: data.error?.message || "Échec de l'émission du billet." };
        }
    } catch (e) {
        return { success: false, error: "Erreur de communication avec le transporteur." };
    }
}
