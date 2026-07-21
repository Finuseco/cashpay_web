
'use client';

/**
 * @fileoverview Service de communication avec l'API Sahl Financial v1.
 * Gère l'authentification, les transactions et les relevés bancaires.
 */

const API_BASE_URL = 'https://api.sahlfinancial.com/v1';
const API_KEY = process.env.SAHL_API_KEY;

interface SahlResponse {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Récupère le solde actuel et les informations du titulaire via Sahl.
 * GET /v1/accounts/{id}/balance
 */
export async function fetchSahlBalance(accountId: string): Promise<SahlResponse> {
    if (!API_KEY || API_KEY.includes('YOUR_')) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { 
            success: true, 
            data: { 
                balance: 12450.75, 
                currency: 'EGP',
                accountHolder: 'Patrick Kamanda'
            } 
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/balance`, {
            headers: { 
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la récupération du solde');
        
        return { 
            success: true, 
            data: { 
                balance: data.balance.amount, 
                currency: data.balance.currency,
                accountHolder: data.account_holder_name || data.name
            } 
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Récupère l'historique des transactions.
 * GET /v1/accounts/{id}/transactions
 */
export async function fetchSahlTransactions(accountId: string): Promise<SahlResponse> {
    console.log(`[Sahl API] Fetching transactions for account: ${accountId}`);

    if (!API_KEY || API_KEY.includes('YOUR_')) {
        await new Promise(resolve => setTimeout(resolve, 800));
        const mockTransactions = [
            { id: '1', transactionDate: new Date().toISOString(), narration: 'Virement Salaire', amount: '2500.00', currency: 'EGP', transactionType: 'CREDIT' },
            { id: '2', transactionDate: new Date(Date.now() - 86400000).toISOString(), narration: 'Achat Supermarché', amount: '45.50', currency: 'EGP', transactionType: 'DEBIT' },
            { id: '3', transactionDate: new Date(Date.now() - 172800000).toISOString(), narration: 'Retrait ATM', amount: '200.00', currency: 'EGP', transactionType: 'DEBIT' },
        ];
        return { success: true, data: mockTransactions };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/transactions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur API Sahl Transactions');

        return { success: true, data: data.transactions };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Récupère la liste des relevés bancaires.
 * GET /v1/accounts/{id}/statements
 */
export async function fetchSahlStatements(accountId: string): Promise<SahlResponse> {
    console.log(`[Sahl API] Fetching statements for account: ${accountId}`);

    if (!API_KEY || API_KEY.includes('YOUR_')) {
        await new Promise(resolve => setTimeout(resolve, 600));
        const mockStatements = [
            { id: 'st_1', period: 'Mars 2024', downloadUrl: '#', date: '2024-04-01' },
            { id: 'st_2', period: 'Février 2024', downloadUrl: '#', date: '2024-03-01' },
        ];
        return { success: true, data: mockStatements };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/statements`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur API Sahl Statements');

        return { success: true, data: data.statements };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
