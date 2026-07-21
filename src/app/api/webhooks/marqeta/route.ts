
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateWebhookSignature } from '@/services/marqeta';
import type { MarqetaEvent } from '@/lib/types';

/**
 * Webhook centralisé pour Marqeta (Core API Events).
 * Gère la synchronisation des statuts de carte et le clearing des transactions.
 * Supporte les types d'événements officiels Marqeta :
 * https://www.marqeta.com/docs/core-api/event-types/
 */
export async function POST(request: NextRequest) {
    const signature = request.headers.get('x-marqeta-signature');

    if (!signature) {
        console.warn('[Marqeta Webhook] Signature manquante.');
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const bodyText = await request.text();
        const isValid = await validateWebhookSignature(bodyText, signature);
        
        if (!isValid) {
            console.error('[Marqeta Webhook] Signature invalide.');
            return new NextResponse('Invalid signature', { status: 401 });
        }

        const event: MarqetaEvent = JSON.parse(bodyText);
        const { type, data, token: eventToken } = event;

        console.log(`[Marqeta Webhook] Processing Event: ${type} (Token: ${eventToken})`);

        switch (type) {
            // --- Synchronisation du statut de la carte ---
            case 'card.active':
            case 'card.suspended':
            case 'card.terminated':
            case 'cardtransition.status.updated':
                const newState = (data.state || data.status || '').toLowerCase();
                if (newState) {
                    const localStatus = newState === 'active' ? 'active' : (newState === 'suspended' ? 'inactive' : 'cancelled');
                    await db.query(
                        'UPDATE cards SET status = $1 WHERE marqeta_card_token = $2',
                        [localStatus, data.card_token || data.token]
                    );
                    console.log(`[Marqeta Webhook] Card synced: ${data.card_token || data.token} is now ${localStatus}`);
                }
                break;

            // --- Synchronisation du clearing financier ---
            case 'transaction.clearing':
                // Une transaction autorisée (JIT) a été finalisée comptablement par le réseau
                await db.query(
                    "UPDATE transactions SET status = 'Completed' WHERE metadata->>'marqeta_token' = $1",
                    [data.token]
                );
                console.log(`[Marqeta Webhook] Transaction cleared: ${data.token}`);
                break;

            // --- Événements Digital Wallet (Apple/Google Pay) ---
            case 'digital_wallet_token.active':
                console.log(`[Marqeta Webhook] Digital Wallet Token activated for card: ${data.card_token}`);
                // Optionnel : Envoyer une notification Push à l'utilisateur
                break;

            default:
                console.log(`[Marqeta Webhook] Unhandled event type: ${type}`);
                break;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Marqeta Webhook] Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
