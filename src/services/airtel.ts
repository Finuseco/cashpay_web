
'use server';

import { encryptWithPublicKey } from '@/lib/encryption';
import { countryToCode } from '@/lib/utils';
import type { User } from '@/lib/types';

// Documentation:
// Cash-out/Payout: https://developers.airtel.africa/documentation/cash-out-apis/1.0
// Collection/Payment: https://developers.airtel.africa/documentation/collection-apis/2.0
// User Enquiry: https://developers.airtel.africa/documentation/user-enquiry/1.0
// Buy Airtime: https://developers.airtel.africa/documentation/buy-airtime/1.0
// Disbursements (v3): https://developers.airtel.africa/documentation/disbursements/3.0

interface ApiResponse {
    success: boolean;
    message?: string;
    data?: any;
    transactionId?: string;
    code?: string;
    status?: 'SUCCESS' | 'PENDING' | 'FAILED' | 'AMBIGUOUS';
}

interface UserVerificationResponse {
    success: boolean;
    name?: string;
    error?: string;
}

const API_BASE_URL = 'https://openapiuat.airtel.africa';
const CLIENT_ID = process.env.AIRTEL_API_CLIENT_ID;
const CLIENT_SECRET = process.env.AIRTEL_API_CLIENT_SECRET;
const AIRTEL_PUBLIC_KEY = process.env.AIRTEL_ENCRYPTION_PUBLIC_KEY;

/**
 * Retrieves an OAuth2 access token from the Airtel Money API.
 */
async function getAirtelAccessToken(): Promise<string | null> {
    if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID.includes('YOUR_KEY')) {
        console.warn("[Airtel Service] API Key/Secret not configured. Cannot get access token.");
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/oauth2/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'grant_type': 'client_credentials'
          }),
          cache: 'no-store'
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Airtel Auth Error:', data);
            throw new Error(`Failed to get access token: ${data.error_description || response.statusText}`);
        }
        return data.access_token;
    } catch (error) {
        console.error('Error fetching Airtel access token:', error);
        return null;
    }
}

/**
 * Encrypts the agent's PIN using Airtel's public key as required by the API.
 */
function getEncryptedPin(pin: string): string {
    if (!AIRTEL_PUBLIC_KEY || AIRTEL_PUBLIC_KEY.includes('YOUR_PUBLIC_KEY')) {
        throw new Error("La clé de chiffrement Airtel n'est pas configurée.");
    }
    return encryptWithPublicKey(pin, AIRTEL_PUBLIC_KEY);
}

// --- COLLECTION API (v2 - USSD Push) ---
interface RequestToPayArgs {
    recipientPhone: string;
    amount: number;
    currency: 'USD' | 'CDF';
    reference: string;
    countryCode: string | null;
}

export async function requestToPay(args: RequestToPayArgs): Promise<ApiResponse> {
    const accessToken = await getAirtelAccessToken();
    if (!accessToken) return { success: false, message: "Impossible d'authentifier avec Airtel." };
    
    const { recipientPhone, amount, currency, reference, countryCode } = args;
    const country = countryToCode(countryCode);
    
    if (!country) {
        return { success: false, message: "Code pays invalide ou non supporté." };
    }

    const mockSignature = "MGsp*********Ag==";
    const mockEncryptedKey = "DVZC*******************NM=";

    const payload = {
      "reference": "CashPay Deposit",
      "subscriber": {
        "country": country,
        "currency": currency,
        "msisdn": recipientPhone
      },
      "transaction": {
        "amount": amount,
        "country": country,
        "currency": currency,
        "id": reference
      }
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/merchant/v2/payments/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'X-Country': country,
                'X-Currency': currency,
                'x-signature': mockSignature,
                'x-key': mockEncryptedKey,
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (response.ok && data.status?.success) {
             return { 
                success: true, 
                status: data.data?.transaction?.status, 
                message: data.status.message, 
                transactionId: data.data?.transaction?.id 
            };
        } else {
             return { success: false, message: data.status?.message || "La demande de paiement a échoué." };
        }
    } catch (error: any) {
         console.error('[Airtel Collection API v2] Critical error:', error);
         return { success: false, message: `An unexpected error occurred: ${error.message}` };
    }
}


// --- DISBURSEMENTS API v3 (New Payout) ---
interface AirtelDisbursementArgs {
    amount: number;
    currency: 'USD' | 'CDF';
    recipientPhone: string;
    reference: string;
    countryCode: string | null;
    pin: string;
}

export async function disburse(args: AirtelDisbursementArgs): Promise<ApiResponse> {
    const accessToken = await getAirtelAccessToken();
    if (!accessToken) return { success: false, message: "Impossible d'authentifier avec Airtel." };

    const { amount, currency, recipientPhone, reference, countryCode, pin } = args;
    const country = countryToCode(countryCode);
    if (!country) return { success: false, message: "Code pays invalide ou non supporté." };
    
    const mockSignature = "mock_signature_base64";
    const mockEncryptedKey = "mock_encrypted_key_base64";
    const encryptedPin = getEncryptedPin(pin);

    try {
        const payload = {
            "payee": {
                "msisdn": recipientPhone,
            },
            "reference": reference,
            "pin": encryptedPin,
            "transaction": {
                "amount": amount,
                "id": reference
            }
        };

        const response = await fetch(`${API_BASE_URL}/standard/v3/disbursements/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Country': country,
                'X-Currency': currency,
                'x-signature': mockSignature,
                'x-key': mockEncryptedKey,
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.status.success) {
            return {
                success: true,
                message: data.status.message,
                transactionId: data.data?.transaction.airtel_money_id
            };
        } else {
            return { success: false, message: data.status.message || 'Le décaissement a échoué.' };
        }

    } catch (error: any) {
        console.error('[Airtel Disbursement API] Critical error:', error);
        return { success: false, message: `An unexpected error occurred: ${error.message}` };
    }
}

// The main `sendRemittance` now points to the new `disburse` function.
export const sendRemittance = disburse;


// --- AIRTIME API ---
interface AirtimeArgs {
    amount: number;
    currency: 'USD' | 'CDF';
    recipientPhone: string;
    agentPin: string;
    reference: string;
    countryCode: string | null;
}

export async function sendAirtime(args: AirtimeArgs): Promise<ApiResponse> {
    const accessToken = await getAirtelAccessToken();
    if (!accessToken) return { success: false, message: "Impossible d'authentifier avec Airtel." };
    
    const { amount, currency, recipientPhone, agentPin, reference, countryCode } = args;
    const country = countryToCode(countryCode);
    if (!country) return { success: false, message: "Code pays invalide ou non supporté." };

    try {
        const encryptedPin = getEncryptedPin(agentPin);

        const payload = {
          "recipient": {
            "country": country,
            "currency": currency,
            "msisdn": recipientPhone
          },
          "recharge": {
            "amount": amount,
            "currency": currency
          },
          "reference": reference,
          "pin": encryptedPin
        };

        const response = await fetch(`${API_BASE_URL}/airtime/v1/agents/am/recharge`, {
             method: 'POST',
             headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.status.success) {
            return {
                success: true,
                message: data.status.message,
                transactionId: data.data.transaction_id
            };
        } else {
            return { success: false, message: data.status.message || 'L\'achat de crédit a échoué.' };
        }

    } catch (error: any) {
        console.error('[Airtel Airtime API] Critical error:', error);
        return { success: false, message: `An unexpected error occurred: ${error.message}` };
    }
}

// --- USER ENQUIRY API ---
export async function verifyAirtelAccountHolder(phoneNumber: string): Promise<UserVerificationResponse> {
    const accessToken = await getAirtelAccessToken();
    if (!accessToken) return { success: false, error: "Impossible d'authentifier avec Airtel." };
    
    const country = 'CD'; // Assuming DRC for now
    
    try {
        const response = await fetch(`${API_BASE_URL}/standard/v1/users/${phoneNumber}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Country': country,
                'X-Currency': 'CDF', // Currency is mandatory for this call
            }
        });
        
        const data = await response.json();

        if (response.ok && data.status.success) {
            const name = `${data.data.first_name} ${data.data.last_name}`;
            return { success: true, name };
        } else {
            return { success: false, error: data.status.message || 'Ce numéro n\'est pas un compte Airtel Money valide.' };
        }
    } catch(error: any) {
        console.error('[Airtel User Enquiry] Critical error:', error);
        return { success: false, error: 'Une erreur de communication est survenue avec le service Airtel.' };
    }
}

// --- ATM WITHDRAWAL (Cash-out) ---
interface AtmWithdrawalArgs {
    amount: number;
    currency: 'USD' | 'CDF';
    recipientPhone: string;
    reference: string;
    countryCode: string | null;
}
export async function getAtmWithdrawalCode(args: AtmWithdrawalArgs): Promise<ApiResponse> {
    console.warn("[Airtel ATM Withdrawal] Using remittance endpoint for ATM withdrawal simulation. This may not be the correct production flow and depends on Airtel's specific ATM integration.");
    
    const atmPayeeMsisdn = '200'; // This needs to be confirmed with Airtel's documentation
    
    const result = await disburse({
        ...args,
        recipientPhone: atmPayeeMsisdn,
        pin: process.env.AIRTEL_SYSTEM_PIN! // Using system PIN for this operation
    });
    
    if (result.success) {
        return {
            success: true,
            code: result.transactionId, // The transaction ID acts as the withdrawal code
            message: "Code de retrait généré avec succès. Présentez ce code au GAB."
        };
    } else {
        return { success: false, message: result.message };
    }
}
      
    