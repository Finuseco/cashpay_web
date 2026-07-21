
'use server';

import { db } from '@/lib/db';
import { handleDbError, getUserFromDb } from './helpers';
import type { User, LinkedBankAccount } from '../types';
import { fetchSahlBalance, fetchSahlTransactions, fetchSahlStatements } from '@/services/sahl';

/**
 * Synchronise le solde et les informations du titulaire d'un compte lié via l'API Sahl.
 */
export async function syncBankAccountBalance(accountId: number): Promise<{ success: boolean; balance?: number; accountHolderName?: string; error?: string }> {
    try {
        const { rows } = await db.query('SELECT provider_account_id, provider FROM linked_bank_accounts WHERE id = $1', [accountId]);
        if (rows.length === 0) throw new Error("Compte non trouvé.");

        const { provider_account_id, provider } = rows[0];
        let newBalance = 0;
        let currency = 'USD';
        let accountHolderName = '';

        if (provider === 'sahl') {
            const result = await fetchSahlBalance(provider_account_id);
            if (!result.success) throw new Error(result.error);
            newBalance = result.data.balance;
            currency = result.data.currency;
            accountHolderName = result.data.accountHolder;
        } else {
            // Simulation par défaut
            newBalance = 1500 + Math.random() * 500;
            accountHolderName = 'Titulaire du Compte';
        }
        
        await db.query(
            'UPDATE linked_bank_accounts SET balance = $1, currency = $2, account_holder_name = $3, updated_at = NOW() WHERE id = $4', 
            [newBalance, currency, accountHolderName, accountId]
        );

        return { success: true, balance: newBalance, accountHolderName };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Récupère le mini-relevé (dernières transactions) d'un compte lié.
 */
export async function getMiniStatementForAccount(accountId: number): Promise<{ success: boolean; transactions?: any[]; error?: string }> {
    try {
        const { rows } = await db.query('SELECT provider_account_id, provider FROM linked_bank_accounts WHERE id = $1', [accountId]);
        if (rows.length === 0) throw new Error("Compte non trouvé.");

        const { provider_account_id, provider } = rows[0];
        
        if (provider === 'sahl') {
            const result = await fetchSahlTransactions(provider_account_id);
            if (!result.success) throw new Error(result.error);
            return { success: true, transactions: result.data };
        }
        
        return { success: true, transactions: [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Récupère la liste des relevés bancaires officiels.
 */
export async function getOfficialStatementsForAccount(accountId: number): Promise<{ success: boolean; statements?: any[]; error?: string }> {
    try {
        const { rows } = await db.query('SELECT provider_account_id, provider FROM linked_bank_accounts WHERE id = $1', [accountId]);
        if (rows.length === 0) throw new Error("Compte non trouvé.");

        const { provider_account_id, provider } = rows[0];
        
        if (provider === 'sahl') {
            const result = await fetchSahlStatements(provider_account_id);
            if (!result.success) throw new Error(result.error);
            return { success: true, statements: result.data };
        }
        
        return { success: true, statements: [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function generateConnectUrl(userId: number): Promise<{ success: boolean; linkUrl?: string; error?: string }> {
  try {
    const user = await getUserFromDb({ userId });
    if (!user) return { success: false, error: 'Utilisateur non trouvé.' };
    
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/banking/callback`;
    const mockConnectUrl = `https://connect.sahlfinancial.com/authorize?client_id=cashpay&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    return { success: true, linkUrl: mockConnectUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getLinkedBankAccounts(userId: number): Promise<LinkedBankAccount[]> {
    try {
        const { rows } = await db.query('SELECT * FROM linked_bank_accounts WHERE user_id = $1 AND status = \'active\'', [userId]);
        return rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            provider: row.provider,
            institutionName: row.institution_name,
            accountHolderName: row.account_holder_name || 'N/A',
            accountType: row.account_type,
            accountNumberMask: row.account_number_mask,
            balance: parseFloat(row.balance || '0'),
            currency: row.currency || 'USD',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            providerAccountId: row.provider_account_id
        }));
    } catch(e) {
        return [];
    }
}

export async function deleteLinkedAccount(userId: number, accountId: number): Promise<{ success: boolean; error?: string }> {
    try {
        await db.query('UPDATE linked_bank_accounts SET status = \'revoked\' WHERE id = $1 AND user_id = $2', [accountId, userId]);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
