
'use server';

import crypto from 'crypto';
import { format } from 'date-fns';

const API_BASE_URL = process.env.ECOBANK_API_URL || 'https://apimuat-developer.ecobank.com';
const CLIENT_ID = process.env.ECOBANK_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOBANK_CLIENT_SECRET;
const PRIVATE_KEY = process.env.EQUITY_PRIVATE_KEY; // Assuming same private key logic for now
const SOURCE_ACCOUNT_NUMBER = process.env.ECOBANK_FLOAT_ACCOUNT;

interface EcobankApiResponse {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
    transactionId?: string;
}

/**
 * Generates a signature for an Equity Bank API request.
 * @param args The components needed to build the signature string.
 * @returns The Base64 encoded RSA-SHA256 signature.
 */
function generateEcobankSignature(args: {
    transactionReference: string;
    timeStamp: string;
    clientID: string;
}): string {
    if (!PRIVATE_KEY) {
        throw new Error("La clé privée d'Ecobank n'est pas configurée.");
    }
    
    const signatureString = `${args.transactionReference}${args.timeStamp}${args.clientID}`;
    
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureString);
    signer.end();
    
    const signature = signer.sign(PRIVATE_KEY, 'base64');
    
    return signature;
}


/**
 * Retrieves an OAuth2 access token from the Ecobank API.
 * This implements the Client Credentials Grant flow.
 * @returns A promise that resolves with the access token or null if it fails.
 */
async function getEcobankAccessToken(): Promise<string | null> {
    if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID.includes('YOUR_ECOBANK_ID')) {
        console.warn("[Ecobank Service] API credentials not configured. Using mock data.");
        // Fallback to a mock response to avoid breaking the flow if credentials aren't set
        return `mock_ecobank_access_token_${Date.now()}`;
    }

    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const tokenUrl = `${API_BASE_URL}/corporate-api-authentication-service/api/v1/token`;

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
            cache: 'no-store',
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('[Ecobank Auth Service] Authentication failed. Status:', response.status);
            console.error('[Ecobank Auth Service] Response Body:', data);
            const errorMessage = data?.error_description || data?.error || data?.message || 'Failed to get Ecobank access token due to an unknown error.';
            throw new Error(errorMessage);
        }

        console.log("[Ecobank Service] Successfully obtained access token.");
        return data.accessToken;
    } catch (error) {
        console.error('Error fetching Ecobank access token:', error);
        throw error; // Re-throw the error to be caught by the calling function
    }
}

export async function getAccountBalance(accountNumber: string): Promise<EcobankApiResponse> {
    console.log(`[Ecobank Service] Fetching balance for account: ${accountNumber}`);
    const accessToken = await getEcobankAccessToken();
    if (!accessToken) {
        return { success: false, error: 'Échec de l\'authentification auprès d\'Ecobank.' };
    }

    const requestId = `CP_INQ_${Date.now()}`;
    const timeStamp = format(new Date(), 'yyyyMMddHHmmss');
    
    // NOTE: Signature generation is a best guess based on other Equity Bank endpoints.
    // The actual signature string to sign for this specific Ecobank endpoint might differ.
    const signature = "MOCK_SIGNATURE"; // Using a mock as the exact string to sign isn't specified for this endpoint.

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://www.cashpay-all.com',
        'X-Client-ID': CLIENT_ID!,
        'X-Signature': signature,
        'X-Timestamp': timeStamp,
        'X-Request-ID': requestId,
    };

    try {
        const response = await fetch(`${API_BASE_URL}/corporate-api-account-inquiry-service/api/v1/account/balance?accountNumber=${accountNumber}`, {
            method: 'GET',
            headers,
            cache: 'no-store'
        });

        const data = await response.json();

        if (response.ok && data.responseCode === '000') {
            console.log(`[Ecobank Service] Balance inquiry successful for account ${accountNumber}`);
            return {
                success: true,
                data: {
                    balance: parseFloat(data.account.availableBalance),
                    currency: data.account.currency,
                    accountHolder: data.account.accountName
                }
            };
        } else {
            console.error('Ecobank Balance Inquiry Error:', data);
            throw new Error(data.responseMessage || 'Échec de la récupération du solde du compte.');
        }

    } catch (error: any) {
        console.error('[Ecobank Service] Critical balance inquiry error:', error);
        return { success: false, error: error.message };
    }
}


interface XpressCashTokenArgs {
    amount: number;
    currency: string;
    recipientPhone: string;
    recipientName: string;
    reference: string;
    countryCode: string;
}

export async function generateXpressCashToken(args: XpressCashTokenArgs): Promise<EcobankApiResponse> {
    console.log(`[Ecobank Service] Generating Xpress Cash token for ${args.recipientPhone}`);
    const accessToken = await getEcobankAccessToken();
    if (!accessToken) {
        return { success: false, error: 'Échec de l\'authentification auprès d\'Ecobank.' };
    }

    const { amount, currency, recipientPhone, recipientName, reference, countryCode } = args;

    const payload = {
        requestId: reference,
        source: {
            countryCode: countryCode,
        },
        recipient: {
            name: recipientName,
            mobile: recipientPhone,
        },
        amount: {
            value: amount,
            currency: currency,
        },
        paymentDetails: {
            type: "CASH_OUT",
            description: `CashPay Xpress Cash withdrawal ref ${reference}`
        }
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/corporate-api-remittance-service/api/v1/remittance/tokenGeneration`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://www.cashpay-all.com'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.status === 'SUCCESS') {
            console.log(`[Ecobank Service] Xpress Cash token generated successfully: ${data.token}`);
            return {
                success: true,
                message: `Token de retrait Xpress Cash généré.`,
                data: {
                    token: data.token,
                    requestId: data.requestId
                }
            };
        } else {
            console.error('Ecobank Token Generation Error:', data);
            throw new Error(data.message || 'Échec de la génération du jeton Xpress Cash.');
        }

    } catch (error: any) {
        console.error('[Ecobank Service] Critical token generation error:', error);
        return { success: false, error: error.message };
    }
}


export async function sendToEcobankAccount(args: { amount: number, currency: string, accountNumber: string, recipientName: string, reference: string, destinationCountry: string }): Promise<EcobankApiResponse> {
    console.log(`[Ecobank Service] Initiating payout to Ecobank account: ${args.accountNumber}`);
    const accessToken = await getEcobankAccessToken();
    if (!accessToken) {
        return { success: false, error: 'Échec de l\'authentification auprès d\'Ecobank.' };
    }
    
    if (!SOURCE_ACCOUNT_NUMBER) {
        return { success: false, error: "Le compte flotte d'Ecobank n'est pas configuré." };
    }

    const payload = {
        requestId: args.reference,
        source: {
            countryCode: "CD", // Assuming CashPay float account is in DRC
            accountNumber: SOURCE_ACCOUNT_NUMBER
        },
        destination: {
            accountNumber: args.accountNumber,
            bankCode: "ECOCCDKI", // Ecobank DRC SWIFT/BIC - this may need to be dynamic based on destination country
            countryCode: args.destinationCountry
        },
        amount: {
            value: args.amount.toString(),
            currency: args.currency
        },
        paymentDetails: {
            type: "ACCOUNT_TRANSFER",
            description: `CashPay Payout Ref: ${args.reference}`
        }
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/payouts/v1/accounts/payment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://www.cashpay-all.com'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.status === 'SUCCESS') {
            console.log(`[Ecobank Service] Payout successful. Provider Transaction ID: ${data.transactionId}`);
            return { success: true, transactionId: data.transactionId, message: data.message };
        } else {
            console.error('Ecobank Payout Error:', data);
            throw new Error(data.message || 'Le virement vers le compte Ecobank a échoué.');
        }

    } catch (error: any) {
        console.error('[Ecobank Service] Critical payout error:', error);
        return { success: false, error: error.message };
    }
}

export async function cancelXpressCashToken(args: { token: string; reason: string; }): Promise<EcobankApiResponse> {
    console.log(`[Ecobank Service] Cancelling Xpress Cash token: ${args.token}`);
    const accessToken = await getEcobankAccessToken();
    if (!accessToken) {
        return { success: false, error: 'Échec de l\'authentification auprès d\'Ecobank.' };
    }

    const payload = {
        requestId: `CP_CANCEL_${Date.now()}`,
        token: args.token,
        reasonForCancellation: args.reason
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/corporate-api-remittance-service/api/v1/remittance/tokenCancellation`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://www.cashpay-all.com'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.status === 'SUCCESS') {
            return { success: true, message: data.message, data: data };
        } else {
            console.error('Ecobank Token Cancellation Error:', data);
            throw new Error(data.message || 'Échec de l\'annulation du jeton.');
        }

    } catch (error: any) {
        console.error('[Ecobank Service] Critical token cancellation error:', error);
        return { success: false, error: error.message };
    }
}

export async function getInstitutionList(countryCode: string): Promise<EcobankApiResponse> {
    console.log(`[Ecobank Service] Fetching institution list for country: ${countryCode}`);
    const accessToken = await getEcobankAccessToken();
    if (!accessToken) {
        return { success: false, error: 'Échec de l\'authentification auprès d\'Ecobank.' };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/corporate-api-rapidtransfer-service/api/v1/options/institutions?countryCode=${countryCode}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://www.cashpay-all.com'
            }
        });
        const data = await response.json();
        if (response.ok) {
            return { success: true, data: data.institutions || [] };
        } else {
            console.error('Ecobank getInstitutionList Error:', data);
            throw new Error(data.message || 'Failed to fetch institutions.');
        }
    } catch (error: any) {
        console.error('[Ecobank Service] Critical getInstitutionList error:', error);
        return { success: false, error: error.message };
    }
}


interface RapidtransferArgs {
    amount: number;
    currency: string;
    accountNumber: string;
    recipientName: string;
    reference: string;
    destinationCountry: string;
    destinationBankCode: string;
    purpose?: string;
}

export async function sendRapidtransfer(args: RapidtransferArgs): Promise<EcobankApiResponse> {
    console.log('[Ecobank Service] Initiating Rapidtransfer payout:', args);
    const accessToken = await getEcobankAccessToken();
    if (!accessToken) {
        return { success: false, error: 'Échec de l\'authentification auprès d\'Ecobank.' };
    }
    
    if (!SOURCE_ACCOUNT_NUMBER) {
        return { success: false, error: "Le compte flotte d'Ecobank n'est pas configuré." };
    }

    const payload = {
        requestId: args.reference,
        source: {
            countryCode: "CD", // Assuming CashPay float account is in DRC
            accountNumber: SOURCE_ACCOUNT_NUMBER
        },
        destination: {
            accountNumber: args.accountNumber,
            bankCode: args.destinationBankCode,
            countryCode: args.destinationCountry
        },
        amount: {
            value: args.amount.toString(),
            currency: args.currency
        },
        paymentDetails: {
            type: "RAPIDTRANSFER",
            description: args.purpose || `CashPay Payout Ref: ${args.reference}`
        }
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/corporate-api-rapidtransfer-service/api/v1/remittance/rapidtransfer`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://www.cashpay-all.com'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.status === 'SUCCESS') {
            console.log(`[Ecobank Service] Rapidtransfer successful. Provider Transaction ID: ${data.transactionId}`);
            return { success: true, transactionId: data.transactionId, message: data.message };
        } else {
            console.error('Ecobank Rapidtransfer Error:', data);
            throw new Error(data.message || 'Le virement Rapidtransfer a échoué.');
        }

    } catch (error: any) {
        console.error('[Ecobank Service] Critical Rapidtransfer error:', error);
        return { success: false, error: error.message };
    }
}
