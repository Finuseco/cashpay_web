'use server';

import { db } from '@/lib/db';
import { handleDbError, saveBase64Image } from './helpers';
import { getAuthenticatedUser } from './user.actions';
import { generateReferenceCode } from '../utils';
import { logIntervention } from './super-agent/utils';

export interface PaymentLink {
    id: number;
    userId: number;
    title: string;
    description: string;
    amount: number | null;
    isFixed: boolean;
    currency: string;
    category: string;
    imageUrl: string | null;
    status: 'active' | 'inactive' | 'blocked';
    visitCount: number;
    collectedAmount: number;
    createdAt: string;
    ownerName?: string;
    ownerWalletId?: string;
}

/**
 * Crée un nouveau lien de paiement.
 */
export async function createPaymentLink(data: any): Promise<{ success: boolean; linkId?: number; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié." };

    try {
        let finalImageUrl = data.imageUrl;
        if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
            finalImageUrl = await saveBase64Image(finalImageUrl, 'payment-links', `link_${user.id}_${Date.now()}`);
        }

        const payload = {
            user_id: user.id,
            title: data.title,
            description: data.description,
            amount: data.isFixed ? data.amount : null,
            is_fixed: data.isFixed,
            currency: data.currency || 'USD',
            category: data.category,
            image_url: finalImageUrl,
            status: 'active'
        };

        const { rows } = await db.query(`
            INSERT INTO payment_links (user_id, title, description, amount, is_fixed, currency, category, image_url, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `, Object.values(payload));

        return { success: true, linkId: rows[0].id };
    } catch (error) {
        const dbError = await handleDbError(error, 'creating payment link');
        return { success: false, error: dbError.error };
    }
}

/**
 * Récupère les liens de paiement d'un utilisateur.
 */
export async function getPaymentLinks(userId: number): Promise<PaymentLink[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                id, user_id as "userId", title, description, amount, 
                is_fixed as "isFixed", currency, category, image_url as "imageUrl", 
                status, visit_count as "visitCount", collected_amount as "collectedAmount", 
                created_at as "createdAt"
            FROM payment_links 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userId]);
        return rows.map(r => ({
            ...r,
            amount: r.amount ? parseFloat(r.amount) : null,
            collectedAmount: parseFloat(r.collectedAmount || 0),
            createdAt: new Date(r.createdAt).toISOString()
        }));
    } catch (error) {
        return [];
    }
}

/**
 * Récupère un lien par son ID (Vue publique).
 */
export async function getPaymentLinkById(id: number): Promise<PaymentLink | null> {
    try {
        const { rows } = await db.query(`
            SELECT 
                pl.*, u.full_name as "ownerName", u.id_wallet as "ownerWalletId"
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            WHERE pl.id = $1
        `, [id]);

        if (rows.length === 0) return null;
        const r = rows[0];

        // Incrémenter le compteur de visites
        db.query('UPDATE payment_links SET visit_count = visit_count + 1 WHERE id = $1', [id]).catch(console.error);

        return {
            ...r,
            userId: r.user_id,
            isFixed: r.is_fixed,
            imageUrl: r.image_url,
            visitCount: r.visit_count,
            collectedAmount: parseFloat(r.collected_amount || 0),
            amount: r.amount ? parseFloat(r.amount) : null,
            ownerName: r.ownerName,
            ownerWalletId: r.ownerWalletId,
            status: r.status
        } as any;
    } catch (error) {
        return null;
    }
}

export async function togglePaymentLinkStatus(id: number, currentStatus: string): Promise<{ success: boolean }> {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await db.query('UPDATE payment_links SET status = $1 WHERE id = $2', [newStatus, id]);
    return { success: true };
}

export async function deletePaymentLink(id: number): Promise<{ success: boolean }> {
    await db.query('DELETE FROM payment_links WHERE id = $1', [id]);
    return { success: true };
}

/**
 * Admin : Récupère tous les liens d'un pays.
 */
export async function getCountryPaymentLinks(countryName: string): Promise<PaymentLink[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                pl.*, u.full_name as "ownerName", u.id_wallet as "ownerWalletId"
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            WHERE u.country = $1
            ORDER BY pl.created_at DESC
        `, [countryName]);
        return rows.map(r => ({
            ...r,
            amount: r.amount ? parseFloat(r.amount) : null,
            collectedAmount: parseFloat(r.collected_amount || 0),
            createdAt: new Date(r.createdAt).toISOString()
        })) as any;
    } catch (error) {
        return [];
    }
}

/**
 * Admin : Bloquer/Débloquer un lien pour suspicion d'arnaque.
 */
export async function superAgentBlockLink(args: { linkId: number, adminId: number, status: 'blocked' | 'active', reason: string }): Promise<{ success: boolean, error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        
        const { linkId, adminId, status, reason } = args;

        await connection.query('UPDATE payment_links SET status = $1 WHERE id = $2', [status, linkId]);
        
        await logIntervention(
            adminId, 
            null, 
            status === 'blocked' ? 'PAYMENT_LINK_BLOCK' : 'PAYMENT_LINK_UNBLOCK', 
            `Lien #${linkId} ${status === 'blocked' ? 'bloqué' : 'débloqué'}. Motif: ${reason}`, 
            connection
        );

        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}