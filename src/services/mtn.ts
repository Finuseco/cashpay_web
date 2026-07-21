

'use server';

/**
 * @fileoverview A service for interacting with the MTN MoMo API.
 * Based on https://momodeveloper.mtn.com/api-documentation
 */

const API_BASE_URL = process.env.MTN_API_URL || 'https://sandbox.momodeveloper.mtn.com';

// Collection API Credentials
const COLLECTION_API_USER_ID = process.env.MTN_COLLECTION_API_USER_ID;
const COLLECTION_API_KEY = process.env.MTN_COLLECTION_API_KEY;

// Disbursement API Credentials
const DISBURSEMENT_API_USER_ID = process.env.MTN_DISBURSEMENT_API_USER_ID;
const DISBURSEMENT_API_KEY = process.env.MTN_DISBURSEMENT_API_KEY;

// Shared Subscription Key
const SUBSCRIPTION_KEY = process.env.MTN_SUBSCRIPTION_KEY;

interface MtnApiResponse {
    success: boolean;
    message: string;
    transactionId?: string;
    status?: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
    data?: any;
}

interface UserVerificationResponse {
    success: boolean;
    name?: string; // MTN's API only confirms validity, doesn't return name
    error?: string;
}


/**
 * Generates an access token for a specific MTN API product.
 * @param product The API product ('collection' or 'disbursement').
 * @returns {Promise<string | null>} The access token or null if failed.
 */
async function getAccessToken(product: 'collection' | 'disbursement'): Promise<string | null> {
    const apiUserId = product === 'collection' ? COLLECTION_API_USER_ID : DISBURSEMENT_API_USER_ID;
    const apiKey = product === 'collection' ? COLLECTION_API_KEY : DISBURSEMENT_API_KEY;

    if (!apiUserId || !apiKey || !SUBSCRIPTION_KEY || apiKey.includes('YOUR_KEY')) {
        console.error(`[MTN Service] Missing ${product} API credentials or Subscription Key.`);
        return null;
    }
    const auth = Buffer.from(`${apiUserId}:${apiKey}`).toString('base64');
    
    try {
        const response = await fetch(`${API_BASE_URL}/${product}/token/`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
            },
            cache: 'no-store'
        });

        const data = await response.json();
        if (!response.ok) {
            console.error(`MTN Auth Error (${product}):`, data);
            return null;
        }
        return data.access_token;
    } catch (error) {
        console.error(`Error fetching MTN ${product} access token:`, error);
        return null;
    }
}


interface RequestToPayArgs {
    amount: number;
    currency: string;
    phoneNumber: string;
    externalId: string;
    payerMessage?: string;
}

/**
 * Initiates a payment request from a customer (Request to Pay).
 */
export async function requestToPay(args: RequestToPayArgs): Promise<MtnApiResponse> {
    const accessToken = await getAccessToken('collection');
    if (!accessToken) {
        return { success: false, message: "Impossible de s'authentifier auprès de MTN." };
    }

    const { amount, currency, phoneNumber, externalId, payerMessage } = args;

    const payload = {
        amount: amount.toString(),
        currency,
        externalId,
        payer: { partyIdType: "MSISDN", partyId: phoneNumber },
        payerMessage: payerMessage || `Paiement de ${amount} ${currency} à CashPay`,
        payeeNote: `Transaction Ref: ${externalId}`
    };

    try {
        const response = await fetch(`${API_BASE_URL}/collection/v1_0/requesttopay`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Reference-Id': externalId,
                'X-Target-Environment': process.env.NODE_ENV === 'production' ? 'mtncongo' : 'sandbox',
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (response.status === 202) {
            return { success: true, message: "Demande de paiement envoyée. Veuillez confirmer sur votre téléphone.", status: 'PENDING', transactionId: externalId };
        } else {
            const errorData = await response.json();
            return { success: false, message: errorData.message || 'Une erreur est survenue avec le service MTN.' };
        }
    } catch (error: any) {
        return { success: false, message: 'Une erreur de communication est survenue avec MTN.' };
    }
}

interface DisbursementArgs {
    amount: number;
    currency: string;
    phoneNumber: string;
    externalId: string;
    payerMessage?: string;
}

/**
 * Initiates a disbursement (payout) to a customer.
 */
export async function disburse(args: DisbursementArgs): Promise<MtnApiResponse> {
    const accessToken = await getAccessToken('disbursement');
    if (!accessToken) {
        return { success: false, message: "Impossible de s'authentifier auprès de MTN pour les paiements." };
    }

    const { amount, currency, phoneNumber, externalId, payerMessage } = args;

    const payload = {
        amount: amount.toString(),
        currency,
        externalId,
        payee: { partyIdType: "MSISDN", partyId: phoneNumber },
        payerMessage: payerMessage || `Paiement de CashPay`,
        payeeNote: `Référence: ${externalId}`
    };

    try {
        const response = await fetch(`${API_BASE_URL}/disbursement/v1_0/transfer`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Reference-Id': externalId,
                'X-Target-Environment': process.env.NODE_ENV === 'production' ? 'mtncongo' : 'sandbox',
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (response.status === 202) {
            return { success: true, message: "Demande de paiement envoyée et en cours de traitement.", status: 'PENDING', transactionId: externalId };
        } else {
            const errorData = await response.json();
            return { success: false, message: errorData.message || 'Le paiement a échoué.' };
        }
    } catch (error: any) {
        return { success: false, message: 'Une erreur de communication est survenue avec MTN.' };
    }
}

/**
 * Checks the status of a request to pay transaction.
 */
export async function getRequestToPayStatus(referenceId: string): Promise<MtnApiResponse> {
    return await getTransactionStatus(referenceId, 'collection');
}

/**
 * Checks the status of a disbursement transaction.
 */
export async function getRequestToWithdrawStatus(referenceId: string): Promise<MtnApiResponse> {
    return await getTransactionStatus(referenceId, 'disbursement');
}


/**
 * Generic function to check the status of a transaction.
 */
async function getTransactionStatus(referenceId: string, product: 'collection' | 'disbursement'): Promise<MtnApiResponse> {
    const accessToken = await getAccessToken(product);
    if (!accessToken) {
        return { success: false, message: "Impossible de s'authentifier." };
    }

    const endpoint = product === 'collection' ? 'requesttopay' : 'transfer';

    try {
        const response = await fetch(`${API_BASE_URL}/${product}/v1_0/${endpoint}/${referenceId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Target-Environment': process.env.NODE_ENV === 'production' ? 'mtncongo' : 'sandbox',
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY!,
            },
        });

        const data = await response.json();
        
        if (response.ok) {
            return {
                success: true,
                message: `Statut: ${data.status}`,
                status: data.status,
                data: data,
            };
        } else {
            return { success: false, message: data.message || `Impossible de vérifier le statut.` };
        }
    } catch (error: any) {
        return { success: false, message: 'Erreur de communication lors de la vérification du statut.' };
    }
}

/**
 * Validates if an account holder is active and registered.
 * Note: This API only confirms existence, it does not return the holder's name.
 */
export async function validateAccountHolder(phoneNumber: string, targetEnvironment: string): Promise<UserVerificationResponse> {
    const accessToken = await getAccessToken('collection');
    if (!accessToken) {
        return { success: false, error: "Impossible de s'authentifier auprès de MTN." };
    }
    
    const partyId = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

    try {
        const response = await fetch(`${API_BASE_URL}/collection/v1_0/accountholder/msisdn/${partyId}/active`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Target-Environment': targetEnvironment,
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY!,
            },
        });

        if (response.status === 200) {
            const data = await response.json();
            if (data === true) {
                return { success: true, name: 'Utilisateur MTN Valide' };
            } else {
                return { success: false, error: 'Le compte MTN n\'est pas actif ou est introuvable.' };
            }
        } else {
            const errorData = await response.json().catch(() => ({ message: 'Réponse invalide de l\'API.' }));
            console.error('MTN ValidateAccountHolder Error:', errorData);
            return { success: false, error: errorData.message || 'La vérification du compte a échoué.' };
        }
    } catch (error: any) {
        console.error('[MTN ValidateAccountHolder] Critical error:', error);
        return { success: false, error: 'Une erreur de communication est survenue avec MTN.' };
    }
}
