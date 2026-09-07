'use server';

import crypto from 'crypto';

/**
 * @fileoverview Service de communication avec l'API PayPal v2 (Mode Live/Sandbox).
 * Gère l'authentification OAuth2 et l'exécution des virements sortants (Payouts).
 */

const PAYPAL_API_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

/**
 * Utilitaire pour effectuer des requêtes fetch sécurisées vers PayPal.
 */
async function safeFetch(url: string, options: RequestInit) {
    const response = await fetch(url, options);
    const text = await response.text();
    
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        console.error(`[PayPal Service] Réponse non-JSON de ${url}:`, text);
        throw new Error(`Le service PayPal a renvoyé une réponse invalide.`);
    }

    if (!response.ok) {
        console.error(`[PayPal API Error] ${url}`, data);
        throw new Error(data.message || data.error_description || `Erreur API PayPal (${response.status})`);
    }

    return data;
}

/**
 * Obtient un jeton d'accès OAuth2 pour l'API PayPal.
 * Les identifiants sont récupérés depuis les variables d'environnement.
 */
async function getPayPalAccessToken(): Promise<string> {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET || PAYPAL_CLIENT_ID.includes('YOUR_')) {
        throw new Error('Identifiants PayPal non configurés ou en mode simulation.');
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
    
    const data = await safeFetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        cache: 'no-store'
    });

    return data.access_token;
}

/**
 * Exécute un virement sortant (Payout) vers un compte PayPal tiers.
 * 
 * @param email L'adresse email du compte PayPal destinataire.
 * @param amount Le montant à envoyer.
 * @param currency La devise (ex: USD, EUR).
 * @param reference La référence unique de transaction interne.
 */
export async function executePayPalPayout(email: string, amount: number, currency: string, reference: string) {
    const accessToken = await getPayPalAccessToken();
    
    const payload = {
        sender_batch_header: {
            sender_batch_id: `Payout_${reference}_${Date.now()}`,
            email_subject: "Vous avez reçu un paiement de CashPay All",
            email_message: "Vos fonds ont été transférés avec succès sur votre compte PayPal via notre réseau souverain."
        },
        items: [
            {
                recipient_type: "EMAIL",
                amount: {
                    value: amount.toFixed(2),
                    currency: currency.toUpperCase()
                },
                note: `Retrait CashPay Réf: ${reference}`,
                sender_item_id: reference,
                receiver: email
            }
        ]
    };

    return await safeFetch(`${PAYPAL_API_URL}/v1/payments/payouts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
}
