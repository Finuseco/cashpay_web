
'use server';

import type { IntlSendArgs } from '@/lib/actions/transfer.actions.ts';

/**
 * @fileoverview A mock service for interacting with the Western Union API.
 */

export interface WesternUnionQuote {
    success: boolean;
    fees: number;
    exchangeRate: number;
    recipientReceives: number;
    error?: string;
}

export interface WesternUnionTransferDetails {
    success: boolean;
    status: 'available' | 'paid' | 'cancelled';
    senderName: string;
    senderCountry: string;
    amount: number;
    currency: string;
    error?: string;
}

const checkApiKey = () => {
    const apiKey = process.env.WESTERN_UNION_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_WU_API_KEY')) {
        console.warn("[WU Service] API Key not configured. Using mock data.");
        return false;
    }
    return true;
}

// Simulates getting a quote for sending money.
export async function getWesternUnionQuote(amount: number, fromCurrency: string, toCountry: string): Promise<WesternUnionQuote> {
    console.log(`[WU Service] Getting quote for ${amount} ${fromCurrency} to ${toCountry}`);
    checkApiKey(); // Log warning if key is missing
    
    // Mock logic: 5% fee, fixed exchange rate for demo
    const fees = amount * 0.05; 
    const exchangeRate = toCountry === 'CD' ? 2800 : 1; // Example rate
    const recipientReceives = (amount - fees) * exchangeRate;
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    return {
        success: true,
        fees,
        exchangeRate,
        recipientReceives
    };
}


// Simulates tracking a transfer using an MTCN.
export async function trackWesternUnionTransfer(mtcn: string): Promise<WesternUnionTransferDetails> {
    console.log(`[WU Service] Tracking MTCN: ${mtcn}`);
    checkApiKey(); // Log warning if key is missing

    await new Promise(resolve => setTimeout(resolve, 700));

    if (mtcn.startsWith('123')) { // Mock for a valid transfer
        return {
            success: true,
            status: 'available',
            senderName: 'John Doe',
            senderCountry: 'USA',
            amount: 150,
            currency: 'USD'
        };
    } else {
        return {
            success: false,
            status: 'cancelled', // Or any other invalid status
            error: 'Le numéro de suivi est invalide ou le transfert n\'est pas disponible.',
            senderName: '',
            senderCountry: '',
            amount: 0,
            currency: ''
        };
    }
}

// Simulates sending money and getting a tracking number.
export async function sendMoney(args: IntlSendArgs): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    console.log('[WU Service] Attempting to send money automatically...');
    checkApiKey();

    // Mock logic: Fail if amount is over 1000 (simulating insufficient partner balance)
    if (args.amount > 1000) {
        console.log('[WU Service] Mock failure: Amount too high for automated sending.');
        return { success: false, error: 'Automatic sending limit exceeded. Queued for manual processing.' };
    }
    
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const mtcn = `123${Math.floor(1000000 + Math.random() * 9000000)}`;
    console.log(`[WU Service] Automated send successful. MTCN: ${mtcn}`);
    
    return { success: true, transactionId: mtcn };
}
