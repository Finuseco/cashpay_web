
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { v4 as uuidv4 } from 'uuid';

/**
 * @fileoverview Actions serveur pour l'approvisionnement (Dépôt) via la passerelle MaxiCash.
 */

/**
 * Initie un dépôt Mobile Money via MaxiCash.
 */
export async function initiateDeposit(data: {
    amount: number;
    user: any;
    countryCode: string;
    operator: string;
    phoneNumber: string;
    paymentMethod: string;
}) {
    console.log(`[MaxiCash] Initiation dépôt Mobile Money:`, data);
    
    // Identifiant unique souverain
    const transactionId = `DEP-${uuidv4().substring(0,8).toUpperCase()}`;
    
    // En production, appel API MaxiCash avec MerchantID/Password
    // POST https://api.maxicashapp.com/v1/merchant/payment
    
    return { 
        success: true, 
        transactionId,
        message: `Une demande de paiement de ${data.amount} USD a été envoyée à votre mobile ${data.phoneNumber}.` 
    };
}

/**
 * Initie un dépôt par Carte Bancaire Prépayée via MaxiCash.
 */
export async function initiateCardDeposit(data: {
    amount: number;
    user: any;
    cardNumber?: string;
    cardHolderName?: string;
    expiryMonth?: string;
    expiryYear?: string;
    cvv?: string;
    currency?: string;
    saveCard?: boolean;
}) {
    const transactionId = `CRD-${uuidv4().substring(0,8).toUpperCase()}`;

    // Sauvegarder la carte si l'utilisateur le demande
    if (data.saveCard && data.cardNumber && data.cardHolderName && data.expiryMonth && data.expiryYear) {
        try {
            const { saveCardForUser } = await import('./card.actions');
            await saveCardForUser({
                cardHolderName: data.cardHolderName,
                cardNumber: data.cardNumber,
                expiryMonth: data.expiryMonth,
                expiryYear: data.expiryYear,
            });
        } catch (e) {
            // Non bloquant : la sauvegarde de carte ne doit pas bloquer le dépôt
            console.error('[initiateCardDeposit] saveCard error:', e);
        }
    }

    return {
        success: true,
        transactionId,
        message: "Redirection vers le portail sécurisé carte MaxiCash..."
    };
}

/**
 * Initie un dépôt PayPal via l'intégration MaxiCash.
 */
export async function initiatePaypalDeposit(data: { amount: number, user: any }) {
    console.log(`[MaxiCash] Initiation dépôt PayPal via Gateway:`, data);
    
    const transactionId = `PP-${uuidv4().substring(0,8).toUpperCase()}`;
    
    return { 
        success: true, 
        transactionId, 
        message: "Ouverture de la passerelle PayPal via MaxiCash..." 
    };
}

/**
 * Vérifie le statut d'une transaction auprès de MaxiCash.
 */
export async function checkDepositStatus(reference: string): Promise<{ success: boolean; status: string; message?: string }> {
    // Appel à l'API de vérification MaxiCash
    // GET /merchant/status?ref=${reference}
    console.log(`[MaxiCash] Vérification statut pour : ${reference}`);
    
    // Pour la démo, on simule un succès après l'initiation
    return { 
        success: true, 
        status: 'Completed', 
        message: "Dépôt validé avec succès." 
    };
}
