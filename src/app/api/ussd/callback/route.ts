
'use server';

import { type NextRequest } from 'next/server';
import { handleUssdRequest } from '@/lib/ussd/ussd.router';

/**
 * Point d'entrée HTTP pour les passerelles Telco USSD.
 * Route configurée sur : *2704#
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const sessionId = formData.get('sessionId') as string;
        const phoneNumber = formData.get('phoneNumber') as string;
        const text = formData.get('text') as string;

        if (!sessionId || !phoneNumber) {
            return new Response("END Paramètres de requête USSD manquants.", { 
                status: 200, // Toujours 200 pour USSD, le message END gère l'erreur
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        const responseText = await handleUssdRequest(sessionId, phoneNumber, text || '');

        return new Response(responseText, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });

    } catch (error) {
        console.error('[API USSD] Critical error:', error);
        return new Response("END Le service USSD est temporairement indisponible.", {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
}
