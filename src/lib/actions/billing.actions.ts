'use server';

import { db } from '../db';
import { handleDbError } from './helpers';

export interface BillingAgreement {
    id: string;
    userId: number;
    merchantName: string;
    merchantId: string;
    status: 'active' | 'cancelled';
    createdAt: string;
}

/**
 * Récupère les accords de facturation réels depuis la base de données.
 * Suppression des données de test (mock).
 */
export async function getBillingAgreements(userId: number): Promise<BillingAgreement[]> {
    try {
        const { rows } = await db.query(
            'SELECT * FROM billing_agreements WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            merchantName: row.merchant_name,
            merchantId: row.merchant_id,
            status: row.status,
            createdAt: new Date(row.created_at).toISOString(),
        }));
    } catch (error) {
        // En cas d'erreur ou si la table n'existe pas encore, on renvoie une liste vide.
        return [];
    }
}

/**
 * Annule un accord de paiement automatique.
 */
export async function cancelBillingAgreement(agreementId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { rowCount } = await db.query(
            "UPDATE billing_agreements SET status = 'cancelled' WHERE id = $1",
            [agreementId]
        );
        if (rowCount === 0) throw new Error("Accord introuvable.");
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'cancelling billing agreement');
        return { success: false, error: dbError.error };
    }
}
