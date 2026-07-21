
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { issuePartnerCard } from '@/lib/actions/b2b.actions';
import { z } from 'zod';

const issueCardSchema = z.object({
    clientInfo: z.object({
        name: z.string().min(3, "Le nom du client est requis."),
        email: z.string().email("L'email du client est invalide."),
    }),
    cardDetails: z.object({
        currency: z.enum(['USD', 'EUR'], { required_error: 'La devise est requise.'}),
        brand: z.enum(['visa', 'mastercard'], { required_error: 'La marque de la carte est requise.' }),
    })
});

/**
 * API Endpoint for B2B Partners to issue a new virtual card.
 * Authenticates using a Bearer token (API Key).
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    const partnerApiKey = authHeader?.split(' ')[1];

    if (!partnerApiKey) {
        return NextResponse.json({ success: false, error: 'Non autorisé: Clé API manquante.' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const validation = issueCardSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ success: false, error: 'Données invalides.', details: validation.error.flatten() }, { status: 400 });
        }
        
        const { clientInfo, cardDetails } = validation.data;

        const result = await issuePartnerCard(partnerApiKey, clientInfo, cardDetails);

        if (result.success) {
            return NextResponse.json({ success: true, card: result.cardData });
        } else {
            // Determine appropriate status code based on error message
            const statusCode = result.error?.includes('Clé API invalide') ? 401 : result.error?.includes('Solde du compte flotte insuffisant') ? 402 : 500;
            return NextResponse.json({ success: false, error: result.error }, { status: statusCode });
        }

    } catch (error) {
        console.error('[B2B Issue Card API] Error:', error);
        return NextResponse.json({ success: false, error: 'Une erreur interne est survenue.' }, { status: 500 });
    }
}
