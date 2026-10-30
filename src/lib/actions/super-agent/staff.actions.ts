
'use server';

import { db } from '@/lib/db';
import { regionalScope, requireSuperAgent, assertManagedUser } from '@/lib/super-agent-access';
import { createTransaction } from '../transaction.actions';
import { formatUser } from '@/lib/utils';
import { logIntervention } from './utils';
import * as bcrypt from 'bcryptjs';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { sendWhatsAppTextMessage } from '@/services/whatsapp';

export async function getCountrySubAgents(countryName: string) {
    const scope = await regionalScope(countryName);
    const { rows } = await db.query(`SELECT u.id, u.full_name, u.phone, u.email, u.province, u.status FROM users u WHERE ${scope.sql} AND u.role = 'SubSuperAgent'`, scope.values);
    return rows;
}

export async function promoteToSubSuperAgent(adminId: number, targetId: number, province: string, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await assertManagedUser(adminId, targetId, connection);
        if (!province?.trim()) throw new Error('Province requise.');
        const { rows: adminRows } = await connection.query('SELECT role, pin_hash FROM users WHERE id = $1', [adminId]);
        if (adminRows.length === 0) throw new Error("Admin non trouvé.");

        const admin = adminRows[0];
        if (admin.role === 'SubSuperAgent') {
            throw new Error("Action interdite : Un Sous-Agent ne peut pas nommer d'autres agents.");
        }

        if (!(await bcrypt.compare(pin, admin.pin_hash))) throw new Error("PIN admin incorrect.");

        await connection.query("UPDATE users SET role = 'SubSuperAgent', province = $1 WHERE id = $2", [province, targetId]);
        await logIntervention(adminId, targetId, 'ROLE_PROMOTION', `Promotion au rang Sous-Agent Provincial (${province})`, connection);

        await connection.query('COMMIT');
        return { success: true };
    } catch(e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}

export async function getInterventionHistory(countryName: string) {
    const scope = await regionalScope(countryName);
    const { rows } = await db.query(`
        SELECT i.*, u.full_name, u.province
        FROM super_agent_interventions i
        JOIN users u ON i.admin_user_id = u.id
        WHERE ${scope.sql}
        ORDER BY i.created_at DESC LIMIT 100
    `, scope.values);
    return rows;
}

/**
 * Envoie une communication de masse à tous les utilisateurs d'un pays.
 */
export async function sendMassCommunication(args: {
    adminId: number;
    channel: 'sms' | 'email' | 'whatsapp';
    subject: string;
    message: string;
    pin: string;
}) {
    const { adminId, channel, subject, message, pin } = args;
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const scope = await regionalScope(undefined, 'u', connection);
        await requireSuperAgent(adminId, connection);
        if (!['sms', 'email', 'whatsapp'].includes(channel) || !message?.trim()) throw new Error('Communication invalide.');
        // 1. Vérifier le PIN et le pays de l'admin
        const { rows: adminRows } = await connection.query('SELECT pin_hash, country FROM users WHERE id = $1', [adminId]);
        if (adminRows.length === 0 || !(await bcrypt.compare(pin, adminRows[0].pin_hash))) {
            throw new Error("PIN Super Agent incorrect.");
        }
        const country = adminRows[0].country;

        // 2. Récupérer les utilisateurs cibles
        const { rows: targets } = await connection.query(
            `SELECT u.full_name, u.email, u.phone, u.first_name FROM users u WHERE ${scope.sql} AND u.status = 'Active'`,
            scope.values
        );

        if (targets.length === 0) throw new Error("Aucun utilisateur actif trouvé dans ce pays.");

        // 3. Journaliser l'action
        await logIntervention(adminId, null, 'MASS_COMMUNICATION', `Envoi massif via ${channel} à ${targets.length} utilisateurs (${country})`, connection);

        // 4. Dispatch (Asynchrone pour ne pas bloquer l'UI)
        let count = 0;
        for (const user of targets) {
            let response: { success: boolean } | undefined;
            try {
                if (channel === 'sms' && user.phone) {
                    response = await sendSms(user.phone, message);
                } else if (channel === 'whatsapp' && user.phone) {
                    response = await sendWhatsAppTextMessage(user.phone, message);
                } else if (channel === 'email' && user.email) {
                    response = await sendEmail(user.email, subject, 'general', {
                        title: subject,
                        greeting: `Bonjour ${user.first_name || user.full_name},`,
                        message: message,
                        buttonText: 'Ouvrir CashPay',
                        buttonUrl: process.env.NEXT_PUBLIC_APP_URL,
                        signature: "Direction Générale CashPay"
                    });
                }
                if (response?.success) count++;
            } catch (err) {
                console.error(`Failed to send mass comm to ${user.email || user.phone}:`, err);
            }
        }

        await connection.query('COMMIT');
        return count > 0 ? { success: true, count, failed: targets.length - count } : { success: false, error: 'Aucun envoi accepté par les fournisseurs.' };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function getCountryProducts(countryName: string) {
    const scope = await regionalScope(countryName);
    try {
        const { rows } = await db.query(`
            SELECT p.*, u.full_name as "sellerName", b.name as "boutiqueName"
            FROM products p
            JOIN users u ON p.agent_id = u.id
            LEFT JOIN boutiques b ON p.boutique_id = b.id
            WHERE ${scope.sql}
            ORDER BY p.created_at DESC
        `, scope.values);

        return rows.map(r => {
            let images = [];
            try {
                images = typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || []);
            } catch (e) {
                images = [r.images];
            }
            return {
                ...r,
                id: r.id.toString(),
                image: images[0] || 'https://placehold.co/100x100.png',
                sellingPrice: parseFloat(r.selling_price),
                seller: { id: r.agent_id.toString(), name: r.sellerName }
            };
        });
    } catch (e) {
        console.error("Error fetching country products:", e);
        throw new Error('Données indisponibles. Réessayez après vérification de la base.');
    }
}

/**
 * Modération Marché : Active ou désactive la visibilité d'un produit.
 */
export async function toggleProductStatus(productId: string, currentStatus: boolean, adminId: number) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const actor = await requireSuperAgent(adminId, connection);
        const { rows } = await connection.query('SELECT agent_id, is_public FROM products WHERE id = $1 FOR UPDATE', [productId]);
        if (!rows[0]) throw new Error('Produit introuvable.');
        await assertManagedUser(actor.id, rows[0].agent_id, connection);
        const newStatus = !rows[0].is_public;
        await connection.query('UPDATE products SET is_public = $1 WHERE id = $2', [newStatus, productId]);

        await logIntervention(adminId, null, 'PRODUCT_MODERATION', `${newStatus ? 'Activation' : 'Blocage'} du produit #${productId}`, connection);

        await connection.query('COMMIT');
        return { success: true, isPublic: newStatus };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

export async function getCountryTvRequests(countryName: string) {
    const scope = await regionalScope(countryName);
    const { rows } = await db.query(`
        SELECT s.*, u.full_name, t.currency
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN transactions t ON t.id = s.transaction_id
        WHERE ${scope.sql} AND s.status = 'pending'
        ORDER BY s.created_at DESC
    `, scope.values);
    return rows;
}

/**
 * Récupère tous les événements en cours dans le pays de l'administrateur.
 */
export async function getCountryEvents(countryName: string) {
    const scope = await regionalScope(countryName);
    try {
        const { rows } = await db.query(`
            SELECT
                e.id, e.name, e.description, e.event_date as "date", e.event_time as "time",
                e.location, e.status, e.currency, e.event_type as "type", e.image_url,
                u.full_name as "organizerName",
                (SELECT SUM(quantity_sold) FROM event_ticket_types WHERE event_id = e.id) as "totalSold"
            FROM events e
            JOIN users u ON e.owner_user_id = u.id
            WHERE ${scope.sql}
            ORDER BY e.event_date DESC
        `, scope.values);
        return rows;
    } catch (e) {
        console.error("[getCountryEvents] Error:", e);
        throw new Error('Données indisponibles. Réessayez après vérification de la base.');
    }
}

/**
 * Modération Événements : Bloque ou réactive un événement.
 */
export async function toggleEventStatus(eventId: number, currentStatus: string, adminId: number) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const actor = await requireSuperAgent(adminId, connection);
        const { rows } = await connection.query('SELECT owner_user_id, status FROM events WHERE id = $1 FOR UPDATE', [eventId]);
        if (!rows[0]) throw new Error('Événement introuvable.');
        await assertManagedUser(actor.id, rows[0].owner_user_id, connection);
        const newStatus = rows[0].status === 'active' ? 'blocked' : 'active';
        await connection.query('UPDATE events SET status = $1 WHERE id = $2', [newStatus, eventId]);

        await logIntervention(adminId, null, 'EVENT_MODERATION', `${newStatus === 'blocked' ? 'Blocage' : 'Réactivation'} de l'événement #${eventId}`, connection);

        await connection.query('COMMIT');
        return { success: true, status: newStatus };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

export async function processTvSubscription(args: { requestId: number; adminId: number; action: 'activate' | 'reject'; pin: string; providerReference?: string }) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await requireSuperAgent(args.adminId, connection);
        const { rows: admins } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [args.adminId]);
        if (!admins[0]?.pin_hash || !(await bcrypt.compare(args.pin, admins[0].pin_hash))) throw new Error('PIN incorrect.');
        const { rows } = await connection.query('SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE', [args.requestId]);
        const request = rows[0];
        if (!request || request.status !== 'pending') throw new Error('Demande inexistante ou déjà traitée.');
        await assertManagedUser(args.adminId, request.user_id, connection);
        if (args.action === 'reject') {
            const { rows: payments } = await connection.query("SELECT * FROM transactions WHERE id = $1 AND sender_id = $2 AND type_code = 'TV' AND status = 'Completed' FOR UPDATE", [request.transaction_id, request.user_id]);
            const payment = payments[0];
            if (!payment) throw new Error('Paiement original confirmé introuvable ou déjà remboursé.');
            const amount = Number(payment.amount) + Number(payment.fee || 0);
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('Montant payé invalide.');
            const { rows: users } = await connection.query('SELECT * FROM users WHERE id = $1', [request.user_id]);
            const result = await createTransaction({ user: formatUser(users[0]), typeCode: 'RW', amount, currency: payment.currency,
                description: `Remboursement abonnement TV #${request.id}`, metadata: { original_transaction_id: payment.id, subscription_id: request.id, approved_by: args.adminId }, connection });
            if (!result.success) throw new Error(result.error || 'Remboursement impossible.');
            await connection.query("UPDATE transactions SET status = 'Reversed' WHERE id = $1", [payment.id]);
            await connection.query("UPDATE subscriptions SET status = 'cancelled' WHERE id = $1", [request.id]);
            await logIntervention(args.adminId, request.user_id, 'TV_REFUND', `Abonnement #${request.id}, remboursement ${amount} ${payment.currency}, paiement #${payment.id}`, connection);
            await connection.query('COMMIT');
            return { success: true, refundedAmount: amount, currency: payment.currency };
        }
        if (args.action !== 'activate') throw new Error('Action inconnue.');
        const reference = args.providerReference?.trim();
        if (!reference || reference.length < 4 || reference.length > 200) throw new Error('Référence de confirmation du fournisseur requise.');
        const { rows: payments } = await connection.query("SELECT id FROM transactions WHERE id = $1 AND sender_id = $2 AND status = 'Completed'", [request.transaction_id, request.user_id]);
        if (!payments.length) throw new Error('Paiement confirmé introuvable.');
        await connection.query("UPDATE subscriptions SET status = 'active' WHERE id = $1", [args.requestId]);
        await logIntervention(args.adminId, request.user_id, 'TV_ACTIVATION', `Abonnement #${args.requestId}, confirmation fournisseur : ${reference}`, connection);
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally { connection.release(); }
}
