
import { NextResponse } from 'next/server';
import { handleUssdRequest } from '@/lib/ussd/ussd.router';

/**
 * API Endpoint public pour les passerelles GSM (Airtel, MTN, Orange, etc.)
 * Traite le protocole USSD standard : Identification par MSISDN.
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        
        // Champs standards envoyés par la plupart des passerelles (ex: Africa's Talking)
        const sessionId = formData.get('sessionId') as string;
        const phoneNumber = formData.get('phoneNumber') as string; // Le MSISDN
        const text = formData.get('text') as string || ''; // La chaîne de commandes (ex: 1*50*1234)

        if (!sessionId || !phoneNumber) {
            return new NextResponse('Invalid USSD request', { status: 400 });
        }

        // Appel du moteur USSD souverain
        // Le numéro de téléphone sert d'identifiant de compte automatique
        const response = await handleUssdRequest(sessionId, phoneNumber, text);

        return new NextResponse(response, {
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch (error) {
        console.error("[USSD API] Fatal Error:", error);
        return new NextResponse('END Erreur temporaire du serveur CashPay. Réessayez.', { status: 500 });
    }
}
