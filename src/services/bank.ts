'use server';

/**
 * @fileoverview A mock service for interacting with a Partner Bank's API.
 * This simulates the connection between CashPay's float account and a real bank like UBA or Equity.
 */

interface BankApiResponse {
    success: boolean;
    data?: any;
    error?: string;
}

const checkApiCredentials = () => {
    // In a real scenario, you'd load credentials for the specific bank (UBA, Equity, etc.)
    const bankApiKey = process.env.PARTNER_BANK_API_KEY;
    if (!bankApiKey || bankApiKey.includes('YOUR_BANK_API_KEY')) {
        console.warn("[Bank Service] Partner Bank API Key not configured. Using mock data.");
        return false;
    }
    return true;
}

/**
 * Simulates fetching the real-time balance of the main float account at the partner bank.
 * @param floatAccountId The account ID of CashPay's float account at the bank.
 * @param currency The currency to check.
 * @returns A promise that resolves with the balance information.
 */
export async function getBankAccountBalance(floatAccountId: string, currency: string): Promise<BankApiResponse> {
    console.log(`[Bank Service] Fetching balance for account ${floatAccountId} in ${currency}...`);
    checkApiCredentials();

    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay

    // Mock response
    return {
        success: true,
        data: {
            accountId: floatAccountId,
            currency: currency,
            balance: 500000.00, // A healthy mock balance
            lastUpdated: new Date().toISOString()
        }
    };
}


interface TransferDetails {
    accountHolderName: string;
    iban: string;
    swift?: string;
    bankName: string;
    country: string;
    reason?: string;
}

/**
 * Simulates initiating a fund transfer from CashPay's float account to an external bank account.
 * @param floatAccountId The source float account ID.
 * @param amount The amount to transfer.
 * @param currency The currency of the transfer.
 * @param recipientDetails The details of the recipient's bank account.
 * @returns A promise that resolves with the transaction result.
 */
export async function initiateBankTransfer(floatAccountId: string, amount: number, currency: string, recipientDetails: TransferDetails): Promise<BankApiResponse> {
    console.log(`[Bank Service] Initiating transfer of ${amount} ${currency} from ${floatAccountId} to ${recipientDetails.bankName} for ${recipientDetails.accountHolderName}`);
    checkApiCredentials();

    if (amount > 100000) {
         return { success: false, error: 'Transfer amount exceeds daily limit for this mock.' };
    }

    await new Promise(resolve => setTimeout(resolve, 1200));

    const transactionId = `BANK_TXN_${Date.now()}`;
    console.log(`[Bank Service] Mock transfer successful. Bank Transaction ID: ${transactionId}`);

    return {
        success: true,
        data: {
            transactionId: transactionId,
            status: 'PROCESSING',
            message: 'Transfer has been successfully initiated with the partner bank.'
        }
    };
}
