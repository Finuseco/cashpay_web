
'use server';

import crypto from 'crypto';
import { format } from 'date-fns';

const API_BASE_URL = process.env.EQUITY_API_URL || 'https://api.equitybankgroup.com/v1/sandpit';
const CLIENT_ID = process.env.EQUITY_CLIENT_ID;
const CLIENT_SECRET = process.env.EQUITY_CLIENT_SECRET;
const PRIVATE_KEY = process.env.EQUITY_PRIVATE_KEY;

interface EquityApiResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
    message?: string;
    data?: any;
}

/**
 * Generates a signature for an Equity Bank API request.
 * @param args The components needed to build the signature string.
 * @returns The Base64 encoded RSA-SHA256 signature.
 */
function generateEquitySignature(args: {
    transactionReference: string;
    timeStamp: string;
    clientID: string;
}): string {
    if (!PRIVATE_KEY) {
        throw new Error("La clé privée d'Equity Bank n'est pas configurée.");
    }
    
    const signatureString = `${args.transactionReference}${args.timeStamp}${args.clientID}`;
    
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureString);
    signer.end();
    
    const signature = signer.sign(PRIVATE_KEY, 'base64');
    
    return signature;
}


/**
 * Retrieves an OAuth2 access token from the Equity Bank API.
 * This implements the Client Credentials Grant flow.
 * @returns A promise that resolves with the access token or null if it fails.
 */
async function getEquityAccessToken(): Promise<string | null> {
    if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID.includes('YOUR_EQUITY_KEY')) {
        console.warn("[Equity Service] API credentials not configured. Using mock data.");
        // Fallback to a mock response to avoid breaking the flow if credentials aren't set
        return `mock_equity_access_token_${Date.now()}`;
    }

    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const tokenUrl = `${API_BASE_URL}/token`;

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
            cache: 'no-store', // Tokens should not be cached
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Equity Bank Auth Error:', data);
            throw new Error(`Failed to get access token: ${data.error_description || response.statusText}`);
        }
        
        console.log("[Equity Service] Successfully obtained access token.");
        return data.access_token;
    } catch (error) {
        console.error('Error fetching Equity Bank access token:', error);
        throw error; // Re-throw the error to be caught by the calling function
    }
}


interface EquityTransferArgs {
    amount: number;
    currency: string;
    accountNumber: string;
    recipientName: string;
    reference: string;
}

export async function sendToEquityAccount(args: EquityTransferArgs): Promise<EquityApiResponse> {
    console.log(`[Equity Service] Initiating transfer to Equity account: ${args.accountNumber}`);
    
    if (!API_BASE_URL) {
        return { success: false, error: "Equity Bank API URL is not configured." };
    }

    const accessToken = await getEquityAccessToken();
    if (!accessToken) {
        return { success: false, error: "Authentication with Equity Bank failed." };
    }
    
    const payload = {
        source: {
            accountNumber: process.env.EQUITY_FLOAT_ACCOUNT, 
            countryCode: "KE" // Assuming Kenya as an example
        },
        destination: {
            accountNumber: args.accountNumber,
            bankCode: "EQBLKENA", // Example bank code
            countryCode: "KE"
        },
        transfer: {
            amount: args.amount,
            currency: args.currency,
            reference: args.reference,
            description: `Transfer from CashPay Ref: ${args.reference}`
        }
    };

    try {
        const timeStamp = format(new Date(), 'yyyyMMddHHmmss');
        const signature = generateEquitySignature({
            transactionReference: args.reference,
            timeStamp: timeStamp,
            clientID: CLIENT_ID!,
        });

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Country-Code': 'KE', 
            'X-Company-ID': 'Equity',
            'X-Signature': signature,
            'X-Timestamp': timeStamp,
            'X-Transaction-Reference': args.reference,
        };
        
        const response = await fetch(`${API_BASE_URL}/transfers`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            cache: 'no-store'
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[Equity Service] Transfer successful. Provider Transaction ID: ${data.transactionId}`);
            return { success: true, transactionId: data.transactionId, message: data.message };
        } else {
            console.error('Equity Bank Transfer Error:', data);
            throw new Error(data.error_description || data.message || 'Transfer failed at Equity Bank.');
        }

    } catch (error: any) {
        console.error('[Equity Service] Error during transfer initiation:', error);
        return { success: false, error: error.message };
    }
}

export async function getAccountBalance(accountNumber: string): Promise<EquityApiResponse> {
    console.log(`[Equity Service] Fetching balance for account: ${accountNumber}`);
    
    if (!API_BASE_URL) {
        return { success: false, error: "Equity Bank API URL is not configured." };
    }

    const accessToken = await getEquityAccessToken();
    if (!accessToken) {
        return { success: false, error: "Authentication with Equity Bank failed." };
    }

    const transactionReference = `CP_INQ_${Date.now()}`;
    const timeStamp = format(new Date(), 'yyyyMMddHHmmss');

    try {
        const signature = generateEquitySignature({
            transactionReference: transactionReference,
            timeStamp: timeStamp,
            clientID: CLIENT_ID!,
        });

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'X-Country-Code': 'KE', // This might need to be dynamic
            'X-Company-ID': 'Equity',
            'X-Signature': signature,
            'X-Timestamp': timeStamp,
            'X-Transaction-Reference': transactionReference,
        };

        const response = await fetch(`${API_BASE_URL}/accounts/${accountNumber}/balance`, {
            method: 'GET',
            headers,
            cache: 'no-store'
        });

        const data = await response.json();

        if (response.ok && data.balance) {
            console.log(`[Equity Service] Balance inquiry successful for account ${accountNumber}`);
            return {
                success: true,
                data: {
                    balance: parseFloat(data.balance),
                    currency: data.currency,
                    accountHolder: data.accountName
                }
            };
        } else {
            console.error('Equity Balance Inquiry Error:', data);
            throw new Error(data.error_description || data.message || 'Failed to retrieve account balance.');
        }

    } catch (error: any) {
        console.error('[Equity Service] Critical balance inquiry error:', error);
        return { success: false, error: error.message };
    }
}

export async function getAccountMiniStatement(accountNumber: string): Promise<EquityApiResponse> {
    console.log(`[Equity Service] Fetching mini-statement for account: ${accountNumber}`);

    if (!API_BASE_URL) {
        return { success: false, error: "Equity Bank API URL is not configured." };
    }

    const accessToken = await getEquityAccessToken();
    if (!accessToken) {
        return { success: false, error: "Authentication with Equity Bank failed." };
    }

    const transactionReference = `CP_STMT_${Date.now()}`;
    const timeStamp = format(new Date(), 'yyyyMMddHHmmss');

    try {
        const signature = generateEquitySignature({
            transactionReference: transactionReference,
            timeStamp: timeStamp,
            clientID: CLIENT_ID!,
        });

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'X-Country-Code': 'KE', // This might need to be dynamic
            'X-Company-ID': 'Equity',
            'X-Signature': signature,
            'X-Timestamp': timeStamp,
            'X-Transaction-Reference': transactionReference,
        };

        const response = await fetch(`${API_BASE_URL}/accounts/${accountNumber}/ministatement`, {
            method: 'GET',
            headers,
            cache: 'no-store'
        });

        const data = await response.json();

        if (response.ok && data.transactions) {
            console.log(`[Equity Service] Mini-statement inquiry successful for account ${accountNumber}`);
            return {
                success: true,
                data: data.transactions // The API returns an array of transactions
            };
        } else {
            console.error('Equity Mini-statement Inquiry Error:', data);
            throw new Error(data.error_description || data.message || 'Failed to retrieve account mini-statement.');
        }

    } catch (error: any) {
        console.error('[Equity Service] Critical mini-statement inquiry error:', error);
        return { success: false, error: error.message };
    }
}
