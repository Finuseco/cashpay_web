
'use server';

/**
 * @fileoverview A service for interacting with the Mastercard Open Banking API.
 * This simulates the API calls needed to link accounts and fetch data.
 */

// This would be your unique Partner ID provided by Mastercard
const PARTNER_ID = process.env.MASTERCARD_PARTNER_ID; 

interface ConnectUrlResponse {
    success: boolean;
    link?: string;
    error?: string;
}

interface TokenResponse {
    success: boolean;
    accessToken?: string;
    error?: string;
}

interface AccountsResponse {
    success: boolean;
    accounts?: {
        providerAccountId: string; // The ID of the account from the provider
        institutionName: string;
        accountType: string;
        accountNumberMask: string;
    }[];
    error?: string;
}


/**
 * Generates a Connect URL to launch the account linking widget.
 * @param customerId - A unique reference to the user in your system.
 * @returns A promise that resolves with the Connect URL.
 */
export async function getConnectUrl(customerId: string): Promise<ConnectUrlResponse> {
    if (!PARTNER_ID) {
        return { success: false, error: "Mastercard Partner ID not configured." };
    }
    
    // In a real scenario, this would make a signed API call to Mastercard.
    // POST /connect/v2/generate
    console.log(`[MC Open Banking] Generating Connect URL for customerId: ${customerId}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay

    // The redirectUri is where Mastercard will send the user back after they link their account.
    // It will include a `code` that we need to exchange for an access token.
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/mastercard/callback`;
    
    // This is a mock URL based on Mastercard's documentation structure.
    const mockConnectUrl = `https://connect.mastercard.com/hosted?partnerId=${PARTNER_ID}&customerId=${customerId}&redirectUri=${encodeURIComponent(redirectUri)}`;
    
    return { success: true, link: mockConnectUrl };
}


/**
 * Exchanges a one-time authorization code for a permanent access token.
 * This happens on the callback route after the user successfully links an account.
 * @param code - The authorization code from the Mastercard redirect.
 * @returns A promise that resolves with the access token.
 */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
    // In a real app, this would be a secure, server-to-server POST request.
    // POST /connect/v2/oauth/token
    console.log(`[MC Open Banking] Exchanging code "${code}" for an access token...`);

    if (!code) {
        return { success: false, error: "Authorization code is missing." };
    }

    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
    
    const mockAccessToken = `mc_at_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    console.log(`[MC Open Banking] Mock Access Token generated: ${mockAccessToken}`);
    
    return { success: true, accessToken: mockAccessToken };
}


/**
 * Fetches the accounts linked by a customer.
 * @param accessToken - The access token obtained after the code exchange.
 * @returns A promise that resolves with the list of linked accounts.
 */
export async function getCustomerAccounts(accessToken: string): Promise<AccountsResponse> {
    // In a real app, this would be: GET /aggregation/v1/customers/{customerId}/accounts
    console.log(`[MC Open Banking] Fetching accounts with token: ${accessToken}`);

    if (!accessToken) {
        return { success: false, error: "Access token is required." };
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    // Mock response simulating a user linking a checking and a savings account
    const mockAccounts = [
        {
            providerAccountId: 'mock_acc_12345_chk',
            institutionName: 'FINBANK',
            accountType: 'checking',
            accountNumberMask: '1111',
        },
        {
            providerAccountId: 'mock_acc_67890_sav',
            institutionName: 'FINBANK',
            accountType: 'savings',
            accountNumberMask: '2222',
        }
    ];

    return { success: true, accounts: mockAccounts };
}

// Other functions would be added here, for example:
// - getAccountTransactions(accessToken: string, accountId: string)
// ...and so on.
