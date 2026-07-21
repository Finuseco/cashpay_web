
'use server';

/**
 * @fileoverview Service de communication avec l'API Jenga (Equity Group) v3.
 * Gère l'authentification OAuth2, la signature RSA-SHA256 et les paiements.
 */

import crypto from 'crypto';
import config from '@/config';

const API_BASE_URL = process.env.JENGA_API_URL || 'https://sandbox.jengahq.io';
const MERCHANT_CODE = config.apiKeys.jengaMerchantCode;
const CONSUMER_SECRET = config.apiKeys.jengaConsumerSecret;
const PRIVATE_KEY = config.apiKeys.jengaPrivateKey;

interface JengaResponse {
    success: boolean;
    data?: any;
    error?: string;
    transactionId?: string;
}

/**
 * Génère la signature RSA-SHA256 requise par Jenga.
 * Documentation : https://developer.jengahq.io/guides/get-started/generate-signature
 * 
 * @param data La chaîne de caractères à signer (dépend de l'endpoint).
 * @returns La signature encodée en Base64.
 */
function generateJengaSignature(data: string): string {
    if (!PRIVATE_KEY || PRIVATE_KEY.includes('YOUR_')) {
        console.warn("[Jenga Service] Private Key not configured. Using mock signature for dev.");
        return "mock_signature_base64_==";
    }

    try {
        // Nettoyage de la clé privée (gestion des sauts de ligne)
        const formattedKey = PRIVATE_KEY.replace(/\\n/g, '\n');
        
        const signer = crypto.createSign('SHA256');
        signer.update(data);
        signer.end();
        
        return signer.sign(formattedKey, 'base64');
    } catch (e: any) {
        console.error("[Jenga Signature Error]", e.message);
        throw new Error("Échec de la signature cryptographique de la transaction.");
    }
}

/**
 * Obtient un jeton d'accès OAuth2 v3.
 */
async function getJengaAccessToken(): Promise<string | null> {
    if (!MERCHANT_CODE || !CONSUMER_SECRET || MERCHANT_CODE.includes('YOUR_')) {
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/authentication/v3/token`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Api-Key': MERCHANT_CODE 
            },
            body: JSON.stringify({ 
                merchantCode: MERCHANT_CODE, 
                consumerSecret: CONSUMER_SECRET 
            }),
            cache: 'no-store'
        });
        const data = await response.json();
        return response.ok ? data.accessToken : null;
    } catch (error) {
        console.error("[Jenga Auth] Connection failed:", error);
        return null;
    }
}

/**
 * Traite un paiement par carte (Direct API / Server-to-Server).
 */
export async function processJengaCardPayment(args: {
    amount: number,
    currency: string,
    reference: string,
    card: any,
    customer: any
}): Promise<JengaResponse> {
    const accessToken = await getJengaAccessToken();
    if (!accessToken) {
        return { success: false, error: "Échec de l'authentification avec la passerelle bancaire." };
    }

    // Pour le paiement par carte, la signature se fait sur {merchantCode}{reference}
    const signature = generateJengaSignature(`${MERCHANT_CODE}${args.reference}`);

    try {
        const response = await fetch(`${API_BASE_URL}/transaction/v3/payment/card`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'Content-Type': 'application/json',
                'Signature': signature 
            },
            body: JSON.stringify(args)
        });
        
        const data = await response.json();
        
        if (response.ok && (data.status === 'SUCCESS' || data.status === 'SUCCESSFUL')) {
            return { 
                success: true, 
                transactionId: data.transactionId || data.reference, 
                data 
            };
        } else {
            return { 
                success: false, 
                error: data.message || data.error_description || "La banque a refusé la transaction." 
            };
        }
    } catch (e) {
        return { success: false, error: "Erreur de communication avec le réseau Jenga." };
    }
}

/**
 * Envoie un virement international SWIFT.
 */
export async function sendSwiftTransfer(args: any): Promise<JengaResponse> {
    const accessToken = await getJengaAccessToken();
    if (!accessToken) return { success: false, error: "Auth failed" };

    const signature = generateJengaSignature(`${MERCHANT_CODE}${args.transfer.reference}`);
    try {
        const response = await fetch(`${API_BASE_URL}/transaction/v3/payouts/swift`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'Content-Type': 'application/json', 
                'Signature': signature 
            },
            body: JSON.stringify(args)
        });
        const data = await response.json();
        return { success: response.ok, transactionId: data.transactionId, data };
    } catch (e) {
        return { success: false, error: "Erreur réseau lors du virement SWIFT." };
    }
}

/**
 * Envoie un virement entre filiales Equity.
 */
export async function sendInterSubsidiaryTransfer(args: any): Promise<JengaResponse> {
    const accessToken = await getJengaAccessToken();
    if (!accessToken) return { success: false, error: "Auth failed" };

    const signature = generateJengaSignature(`${MERCHANT_CODE}${args.transfer.reference}`);
    try {
        const response = await fetch(`${API_BASE_URL}/transaction/v3/payouts/intersubsidiary`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'Content-Type': 'application/json', 
                'Signature': signature 
            },
            body: JSON.stringify(args)
        });
        const data = await response.json();
        return { success: response.ok, transactionId: data.transactionId, data };
    } catch (e) {
        return { success: false, error: "Erreur réseau lors du virement inter-filiales." };
    }
}
