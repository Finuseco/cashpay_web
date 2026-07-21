

'use server';

import { createTransaction } from './transaction.actions';
import type { User, RegidesoInvoice, RegidesoAbonnement } from '@/lib/types';
import { handleDbError } from './helpers';
import { db } from '../db';
import { payMpesaB2B, updateMpesaTransactionStatus } from '@/services/mpesa';


const REGIDESO_API_URL = process.env.REGIDESO_API_URL || 'https://facture.regideso.cd';
const REGIDESO_API_TOKEN = process.env.REGIDESO_API_TOKEN;


export async function getRegidesoInvoices(abonnementId: string): Promise<{ success: boolean; invoices?: RegidesoInvoice[]; error?: string }> {
    if (!REGIDESO_API_TOKEN || REGIDESO_API_TOKEN.includes('YOUR_TOKEN')) {
        const errorMsg = 'Le service REGIDESO n\'est pas configuré.';
        console.error(`[REGIDESO Service] ${errorMsg}`);
        return { success: false, error: errorMsg };
    }
    
    try {
        const response = await fetch(`${REGIDESO_API_URL}/all/${abonnementId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${REGIDESO_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.message || 'Impossible de récupérer les factures.' };
        }
        
        return { success: true, invoices: data.result as RegidesoInvoice[] };

    } catch (error) {
        const dbError = await handleDbError(error, 'fetching Regideso invoices');
        return { success: false, error: dbError.error };
    }
}


export async function payRegidesoInvoices(user: User, invoices: RegidesoInvoice[]): Promise<{ success: boolean; error?: string; reference?: string }> {
    if (invoices.length === 0) {
        return { success: false, error: "Aucune facture sélectionnée." };
    }

    const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.montant_ttc.toString().replace(/,/g, '')), 0);
    const invoiceNumbers = invoices.map(inv => inv.numero_facture).join(', ');

    // 1. Débiter le portefeuille de l'utilisateur pour le montant total
    const transactionResult = await createTransaction({
        user,
        typeCode: 'BILL',
        amount: totalAmount,
        currency: invoices[0].devise, // Assume all invoices are in the same currency
        description: `Paiement factures REGIDESO: ${invoiceNumbers}`,
        metadata: { billDetails: invoices },
        status: 'Pending'
    });

    if (!transactionResult.success || !transactionResult.reference) {
        return { success: false, error: transactionResult.error || "Le paiement des factures a échoué." };
    }
    
    // 2. Confirmer le paiement auprès de l'API de la REGIDESO (ou M-Pesa B2B)
    try {
        const regidesoMpesaShortCode = process.env.REGIDESO_MPESA_SHORTCODE;
        if (!regidesoMpesaShortCode) {
            throw new Error("Le compte M-Pesa de la REGIDESO n'est pas configuré.");
        }
        
        const b2bResult = await payMpesaB2B({
            amount: totalAmount,
            currency: invoices[0].devise,
            recipientShortCode: regidesoMpesaShortCode,
            description: `Paiement factures ${invoiceNumbers} pour client ${user.id_wallet}`,
            reference: transactionResult.reference
        });
        
        if (!b2bResult.success) {
            // Idéalement, il faudrait une logique pour annuler la transaction précédente
            console.error(`Paiement M-Pesa B2B échoué après débit pour factures ${invoiceNumbers}. Réf: ${transactionResult.reference}. Erreur: ${b2bResult.message}`);
            return { success: false, error: `Le paiement a été débité mais la confirmation a échoué. Contactez le support avec la réf: ${transactionResult.reference}` };
        }
        
        const mpesaTransactionId = b2bResult.data?.output_TransactionID;
        if (mpesaTransactionId) {
            // Commit the transaction
            await updateMpesaTransactionStatus('commit', mpesaTransactionId);
        }

        // Finalize our internal transaction
        await db.query('UPDATE transactions SET status = $1 WHERE reference_code = $2', ['Completed', transactionResult.reference]);

        return { success: true, reference: transactionResult.reference };

    } catch (error) {
        // Idéalement, il faudrait une logique pour annuler la transaction précédente
        const dbError = await handleDbError(error, 'paying Regideso invoices via M-Pesa B2B');
        console.error(`Paiement REGIDESO échoué après débit (erreur critique). Réf: ${transactionResult.reference}. Erreur:`, dbError.error);
        return { success: false, error: `Le paiement a été débité mais une erreur critique est survenue. Contactez le support avec la réf: ${transactionResult.reference}` };
    }
}

export async function submitRegidesoIndex(userId: number, abonnementId: string, indexValue: number) {
    console.log(`[REGIDESO Action] Simulating index submission for user ${userId}, abonnement ${abonnementId}, index ${indexValue}`);
    // This is a mock function. In a real application, this would call the REGIDESO API endpoint for index submission.
    if(indexValue < 100) {
        return { success: false, error: "La valeur de l'index semble trop basse. Veuillez vérifier."}
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true };
}


export async function getUserAbonnements(userId: number): Promise<RegidesoAbonnement[]> {
    try {
        const {rows} = await db.query('SELECT * FROM user_regideso_abonnements WHERE user_id = $1', [userId]);
        return rows as RegidesoAbonnement[];
    } catch(error) {
        await handleDbError(error, 'fetching Regideso abonnements');
        return [];
    }
}

export async function addUserAbonnement(userId: number, data: { alias: string; abonnementId: string }): Promise<{success: boolean; abonnements?: RegidesoAbonnement[], error?: string}> {
    try {
        await db.query('INSERT INTO user_regideso_abonnements (user_id, alias, abonnement_id) VALUES ($1, $2, $3)', [userId, data.alias, data.abonnementId]);
        const updatedAbonnements = await getUserAbonnements(userId);
        return { success: true, abonnements: updatedAbonnements };
    } catch (error) {
        const dbError = await handleDbError(error, 'adding Regideso abonnement');
        return { success: false, error: dbError.error };
    }
}
