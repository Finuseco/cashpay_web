'use server';

import type { IntlSendArgs } from '@/lib/actions/transfer.actions';

/**
 * @fileoverview A mock service for interacting with the RIA Money Transfer API.
 */

export interface RiaQuote {
    success: boolean;
    fees: number;
    exchangeRate: number;
    recipientReceives: number;
    error?: string;
}

export interface RiaTransferDetails {
    success: boolean;
    status: 'available' | 'paid' | 'cancelled';
    senderName: string;
    senderCountry: string;
    amount: number;
    currency: string;
    error?: string;
}

const checkApiKey = () => {
    const apiKey = process.env.RIA_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_RIA_API_KEY')) {
        console.warn("[RIA Service] API Key not configured. Using mock data.");
        return false;
    }
    return true;
}

// Simulates getting a quote for sending money via RIA.
export async function getRiaQuote(amount: number, fromCurrency: string, toCountry: string): Promise<RiaQuote> {
    console.log(`[RIA Service] Getting quote for ${amount} ${fromCurrency} to ${toCountry}`);
    checkApiKey();
    
    const fees = 5.50; // Mock fixed fee
    const exchangeRate = toCountry === 'CD' ? 2810 : 0.99;
    const recipientReceives = (amount - fees) * exchangeRate;
    
    await new Promise(resolve => setTimeout(resolve, 450));

    return {
        success: true,
        fees,
        exchangeRate,
        recipientReceives
    };
}


// Simulates tracking a transfer using a RIA transfer code.
export async function trackRiaTransfer(transferCode: string): Promise<RiaTransferDetails> {
    console.log(`[RIA Service] Tracking code: ${transferCode}`);
    checkApiKey();

    await new Promise(resolve => setTimeout(resolve, 650));

    if (transferCode.startsWith('RIA')) {
        return {
            success: true,
            status: 'available',
            senderName: 'Carlos Garcia',
            senderCountry: 'Espagne',
            amount: 500,
            currency: 'EUR'
        };
    } else {
        return {
            success: false,
            status: 'cancelled',
            error: 'Le code de transfert RIA est invalide ou introuvable.',
            senderName: '',
            senderCountry: '',
            amount: 0,
            currency: ''
        };
    }
}

// Simulates sending money and getting a tracking number.
export async function sendMoney(args: IntlSendArgs): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    console.log('[RIA Service] Attempting to send money automatically...');
    checkApiKey();

    // Mock logic: Always succeed for RIA in this demo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const pin = `RIA${Math.floor(100000000 + Math.random() * 900000000)}`;
    console.log(`[RIA Service] Automated send successful. Transaction ID: ${pin}`);
    
    return { success: true, transactionId: pin };
}
