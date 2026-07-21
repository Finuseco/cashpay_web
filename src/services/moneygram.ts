
'use server';

import type { IntlSendArgs } from '@/lib/actions/transfer.actions.ts';

/**
 * @fileoverview A mock service for interacting with the MoneyGram API.
 */

export interface MoneyGramQuote {
    success: boolean;
    fees: number;
    exchangeRate: number;
    recipientReceives: number;
    error?: string;
}

export interface MoneyGramTransferDetails {
    success: boolean;
    status: 'available' | 'paid' | 'cancelled' | 'in_progress';
    senderName: string;
    senderCountry: string;
    amount: number;
    currency: string;
    error?: string;
}

const checkApiKey = () => {
    const apiKey = process.env.MONEYGRAM_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_MG_API_KEY')) {
        console.warn("[MoneyGram Service] API Key not configured. Using mock data.");
        return false;
    }
    return true;
}

// Simulates getting a quote for sending money via MoneyGram.
export async function getMoneyGramQuote(amount: number, fromCurrency: string, toCountry: string): Promise<MoneyGramQuote> {
    console.log(`[MoneyGram Service] Getting quote for ${amount} ${fromCurrency} to ${toCountry}`);
    checkApiKey();
    
    // Mock logic: 4.5% fee + $2 fixed, different exchange rate
    const fees = (amount * 0.045) + 2; 
    const exchangeRate = toCountry === 'CD' ? 2820 : 1.01; // Example rate
    const recipientReceives = (amount - fees) * exchangeRate;
    
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate network delay

    return {
        success: true,
        fees,
        exchangeRate,
        recipientReceives
    };
}


// Simulates tracking a transfer using a MoneyGram tracking number.
export async function trackMoneyGramTransfer(trackingNumber: string): Promise<MoneyGramTransferDetails> {
    console.log(`[MoneyGram Service] Tracking number: ${trackingNumber}`);
    checkApiKey();

    await new Promise(resolve => setTimeout(resolve, 800));

    if (trackingNumber.startsWith('MG')) { // Mock for a valid transfer
        return {
            success: true,
            status: 'available',
            senderName: 'Jane Smith',
            senderCountry: 'UK',
            amount: 200,
            currency: 'EUR'
        };
    } else {
        return {
            success: false,
            status: 'cancelled',
            error: 'Le numéro de suivi MoneyGram est invalide ou introuvable.',
            senderName: '',
            senderCountry: '',
            amount: 0,
            currency: ''
        };
    }
}


// Simulates sending money and getting a tracking number.
export async function sendMoney(args: IntlSendArgs): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    console.log('[MoneyGram Service] Attempting to send money automatically...');
    checkApiKey();

    if (args.amount > 1500) {
        console.log('[MoneyGram Service] Mock failure: Amount too high for automated sending.');
        return { success: false, error: 'Automatic sending limit exceeded. Queued for manual processing.' };
    }
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const transactionId = `MG${Math.floor(10000000 + Math.random() * 90000000)}`;
    console.log(`[MoneyGram Service] Automated send successful. Transaction ID: ${transactionId}`);
    
    return { success: true, transactionId };
}
