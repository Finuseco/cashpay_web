
'use server';

import type { User } from '@/lib/types';

const API_BASE_URL = process.env.UBA_API_URL || 'https://seerbitapi.com';
const PUBLIC_KEY = process.env.UBA_PUBLIC_KEY;
const SECRET_KEY = process.env.UBA_SECRET_KEY;

interface UbaApiResponse {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
}

/**
 * Retrieves an OAuth2 access token from the SeerBit API for UBA.
 */
async function getUbaAccessToken(): Promise<string | null> {
    if (!PUBLIC_KEY || !SECRET_KEY || PUBLIC_KEY.includes('YOUR_KEY')) {
        throw new Error("Les identifiants de l'API UBA ne sont pas configurés.");
    }

    const tokenUrl = `${API_BASE_URL}/auth`;
    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                publicKey: PUBLIC_KEY,
                secretKey: SECRET_KEY,
            }),
            cache: 'no-store',
        });

        const data = await response.json();
        if (data?.status?.toLowerCase() !== 'success') {
            console.error('UBA Auth Error:', data);
            throw new Error(data?.message || 'Failed to get UBA access token.');
        }
        
        console.log("[UBA Service] Successfully obtained access token.");
        return data.data.token;
    } catch (error) {
        console.error('Error fetching UBA access token:', error);
        throw error;
    }
}

interface UbaTransferArgs {
    amount: number;
    currency: string;
    accountNumber: string;
    recipientName: string;
    reference: string;
    destinationBankCode: string;
}

/**
 * Sends money to a UBA bank account via the SeerBit API.
 */
export async function sendToUbaAccount(args: UbaTransferArgs): Promise<UbaApiResponse> {
    console.log(`[UBA Service] Initiating transfer to UBA account: ${args.accountNumber}`);
    
    try {
        const accessToken = await getUbaAccessToken();
        if (!accessToken) {
            return { success: false, error: "L'authentification auprès du service UBA a échoué." };
        }
        
        const payload = {
            publicKey: PUBLIC_KEY,
            amount: args.amount,
            currency: args.currency,
            country: 'NG', // Example country, might need to be dynamic
            paymentReference: args.reference,
            productId: 'UBA_ACCOUNT_TRANSFER',
            email: `payout_${args.reference}@cashpay.cd`,
            bank: {
                accountName: args.recipientName,
                accountNumber: args.accountNumber,
                bankCode: args.destinationBankCode,
            }
        };

        const response = await fetch(`${API_BASE_URL}/transfer/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();

        if (data?.status?.toLowerCase() === 'success' && data?.data?.code === '00') {
             console.log(`[UBA Service] Payout successful. Provider Reference: ${data.data.payment.paymentReference}`);
             return { success: true, data: data.data.payment, message: data.message };
        } else {
             console.error('UBA Payout Error:', data);
             throw new Error(data?.message || 'Le virement vers le compte UBA a échoué.');
        }

    } catch (error: any) {
        console.error('[UBA Service] Critical payout error:', error);
        return { success: false, error: error.message };
    }
}

export interface UbaVirtualAccountArgs {
    user: User;
    amount: number;
    currency: string;
    reference: string;
}

export async function generateUbaDepositVirtualAccount(args: UbaVirtualAccountArgs): Promise<UbaApiResponse> {
    console.log(`[UBA Service] Generating virtual account for deposit:`, args);

    try {
        const accessToken = await getUbaAccessToken();
        if (!accessToken) {
            return { success: false, error: "L'authentification auprès du service UBA a échoué." };
        }

        const payload = {
            publicKey: PUBLIC_KEY,
            fullName: args.user.full_name,
            email: args.user.email,
            mobileNumber: args.user.phone,
            amount: args.amount.toString(),
            currency: args.currency,
            country: 'NG', // The API seems to require NG, this might need to be adjusted based on real credentials
            paymentReference: args.reference,
            productId: `DEPOSIT-${args.user.id}`,
            productDescription: `CashPay Deposit for ${args.user.id_wallet}`,
        };
        
        const response = await fetch(`${API_BASE_URL}/virtual-account`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data?.status?.toLowerCase() === 'success' && data?.data?.code === '00') {
             console.log(`[UBA Service] Virtual Account generated successfully.`, data.data.payments);
             return { success: true, data: data.data.payments, message: data.message };
        } else {
             console.error('UBA Virtual Account Error:', data);
             throw new Error(data?.message || 'La génération du compte virtuel UBA a échoué.');
        }

    } catch (error: any) {
        console.error('[UBA Service] Critical virtual account error:', error);
        return { success: false, error: error.message };
    }
}
