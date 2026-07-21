
import { NextResponse } from 'next/server';
import { handleUssdRequest } from '@/lib/actions/ussd.actions';

/**
 * POINT D'ENTRÉE PRODUCTION USSD
 * Endpoint: web.cashpay-all.com/ussd
 * Reçoit les requêtes POST des passerelles GSM (Airtel, Orange, Vodacom, MTN).
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        
        // Paramètres standards USSD
        const sessionId = formData.get('sessionId') as string;
        const phoneNumber = formData.get('phoneNumber') as string; // MSISDN de l'utilisateur
        const text = formData.get('text') as string || ''; // Chaîne de commande USSD

        if (!sessionId || !phoneNumber) {
            return new NextResponse('Invalid request parameters', { status: 400 });
        }

        // Appel du moteur USSD souverain
        const response = await handleUssdRequest(sessionId, phoneNumber, text);

        // Retourne la réponse brute (CON/END) attendue par la passerelle
        return new NextResponse(response, {
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch (error) {
        console.error("[USSD GATEWAY] Fatal Error:", error);
        return new NextResponse('END Erreur technique temporaire. Réessayez plus tard.', { status: 500 });
    }
}
