
'use server';

import type { IntlSendArgs } from '@/lib/actions/transfer.actions.ts';

/**
 * @fileoverview A mock service for interacting with the Mastercard Send Funding API.
 */

interface MastercardSendResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
}

const checkApiKey = () => {
    const apiKey = process.env.MASTERCARD_SEND_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_MC_SEND_KEY')) {
        console.warn("[Mastercard Send Service] API Key not configured. Using mock data.");
        return false;
    }
    return true;
}

/**
 * Simulates sending money to a Mastercard card, including test scenarios.
 * @param args The international send arguments.
 * @returns A promise that resolves with the transaction result.
 */
export async function sendMoney(args: IntlSendArgs): Promise<MastercardSendResponse> {
    console.log('[Mastercard Send Service] Attempting to send money via Mastercard Send...');
    checkApiKey();

    // --- TEST SCENARIOS ---
    if (args.amount > 2500) {
        console.log('[Mastercard Send Service] Mock failure: Amount exceeds transaction limit.');
        return { success: false, error: 'The amount exceeds the limit for Mastercard Send. (TEST_SCENARIO)' };
    }
    
    // Simulate a failure based on recipient's name for testing purposes
    if (args.recipientName.toLowerCase().includes('fail') || args.recipientName.toLowerCase().includes('error')) {
        console.log('[Mastercard Send Service] Mock failure: Recipient name triggered a test failure.');
        return { success: false, error: 'Recipient data invalid. Please check the name. (TEST_SCENARIO_RECIPIENT_FAIL)' };
    }
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // --- SUCCESS SCENARIO ---
    const transactionId = `MCSFUND_${Date.now()}`;
    console.log(`[Mastercard Send Service] Send successful. Transaction ID: ${transactionId}`);
    
    return { success: true, transactionId };
}
