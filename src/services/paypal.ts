
'use server';

import config from '@/config';
import type { User } from '@/lib/types';
import crypto from 'crypto';

/**
 * @fileoverview Service de communication avec l'API PayPal Live.
 * Spécialisé uniquement pour les paiements via compte PayPal (Balance/Redirect).
 * La gestion des cartes bancaires est transférée au service Jenga (Equity Bank).
 */

const PAYPAL_API_URL = (process.env.PAYPAL_API_URL || 'https://api-m.paypal.com').replace(/\/$/, '');
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

/**
 * Effectue une requête fetch robuste avec gestion du parsing.
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
 * Obtient un jeton d'accès OAuth2 pour l'API PayPal Live.
 */
async function getPayPalAccessToken(): Promise<string> {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
        throw new Error('Identifiants PayPal non configurés.');
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
 * Crée une commande PayPal (Order) V2 - Mode redirection standard.
 */
export async function createPayPalOrder(amount: number, currency: string, user: User, method: 'paypal_email') {
    const accessToken = await getPayPalAccessToken();
    const amountStr = amount.toFixed(2);
    const paypalCurrency = currency.toUpperCase() === 'USD' ? 'USD' : 'EUR';

    const payload: any = {
        intent: 'CAPTURE',
        purchase_units: [{
            reference_id: `CP_DEP_${Date.now()}_${user.id}`,
            amount: {
                currency_code: paypalCurrency,
                value: amountStr,
            },
            description: `Approvisionnement de compte CashPay pour ${user.full_name}`,
        }],
        payment_source: {
            paypal: {
                experience_context: {
                    brand_name: "CashPay",
                    shipping_preference: "NO_SHIPPING",
                    user_action: "PAY_NOW",
                    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?status=success`,
                    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?status=cancel`
                }
            }
        }
    };

    return await safeFetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });
}
