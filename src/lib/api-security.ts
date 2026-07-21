
import { headers } from 'next/headers';
import crypto from 'crypto';

/**
 * @fileoverview Utilitaire de sécurité pour l'API mobile CashPay.
 * Valide la signature HMAC-SHA256 des requêtes entrantes.
 */

const API_SECRET = process.env.API_GATEWAY_SECRET || 'cp_internal_secret_key_2024';

export async function validateApiSignature(request: Request): Promise<{ isValid: boolean; error?: string }> {
    const headerList = headers();
    
    const signature = headerList.get('X-CashPay-Signature');
    const timestamp = headerList.get('X-CashPay-Timestamp');
    const appId = headerList.get('X-CashPay-App-ID');

    if (!signature || !timestamp || !appId) {
        return { isValid: false, error: 'Missing security headers.' };
    }

    // Vérification de la fraîcheur du timestamp (max 5 minutes d'écart)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    if (Math.abs(now - requestTime) > 300) {
        return { isValid: false, error: 'Request timestamp expired.' };
    }

    try {
        const method = request.method.toUpperCase();
        const url = new URL(request.url);
        const path = url.pathname;
        
        let body = '';
        if (method !== 'GET' && method !== 'DELETE') {
            const clonedRequest = request.clone();
            body = await clonedRequest.text();
        }

        const dataToSign = `${method}${path}${timestamp}${body}`;
        const expectedSignature = crypto
            .createHmac('sha256', API_SECRET)
            .update(dataToSign)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error(`[API Security] Invalid signature. Path: ${path}`);
            return { isValid: false, error: 'Invalid request signature.' };
        }

        return { isValid: true };
    } catch (e) {
        return { isValid: false, error: 'Security validation error.' };
    }
}
