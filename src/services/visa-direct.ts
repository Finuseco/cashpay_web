'use server';

import type { IntlSendArgs } from '@/lib/actions/transfer.actions';

/**
 * @fileoverview A mock service for interacting with the Visa Direct API.
 */

interface VisaDirectResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
}

const checkApiKey = () => {
    const apiKey = process.env.VISA_DIRECT_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_VD_KEY')) {
        console.warn("[Visa Direct Service] API Key not configured. Using mock data.");
        return false;
    }
    return true;
}

/**
 * Simulates sending money to a Visa card using the Visa Direct PushFunds API.
 * @param args The international send arguments, including recipientCardNumber.
 * @returns A promise that resolves with the transaction result.
 */
export async function sendMoney(args: IntlSendArgs): Promise<VisaDirectResponse> {
    console.log('[Visa Direct Service] Attempting to send money via Visa Direct PushFunds...');
    checkApiKey();

    if (!args.recipientCardNumber || !args.recipientCardNumber.startsWith('4')) {
        console.log('[Visa Direct Service] Mock failure: Invalid recipient Visa card number.');
        return { success: false, error: 'Le numéro de carte Visa du bénéficiaire est invalide.' };
    }
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1300));
    
    // --- SUCCESS SCENARIO ---
    const transactionId = `VISAD_${Date.now()}`;
    console.log(`[Visa Direct Service] PushFunds successful. Transaction ID: ${transactionId}`);
    
    return { success: true, transactionId };
}


/**
 * Simulates adjusting or reversing a Visa Direct transaction.
 * @param originalTransactionId The unique identifier of the original transaction to adjust.
 * @param adjustmentAmount The amount to adjust.
 * @returns A promise that resolves with the adjustment result.
 */
export async function adjustVisaDirectTransaction(originalTransactionId: string, adjustmentAmount: number): Promise<VisaDirectResponse> {
    console.log(`[Visa Direct Service] Adjusting transaction ${originalTransactionId} by ${adjustmentAmount}`);
    checkApiKey();

    // In a real scenario, you would build a specific payload for the adjustment API.
    const payload = {
        //... fields required by Visa's adjustment API
        originalTransactionId,
        adjustmentAmount,
    };

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 900));

    // Simulate success
    const adjustmentId = `ADJ_${Date.now()}`;
    console.log(`[Visa Direct Service] Adjustment successful. Adjustment ID: ${adjustmentId}`);

    return { success: true, transactionId: adjustmentId };
}
