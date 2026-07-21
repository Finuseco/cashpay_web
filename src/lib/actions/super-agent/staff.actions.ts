
'use server';

import { db } from '@/lib/db';
import { logIntervention } from './utils';
import * as bcrypt from 'bcryptjs';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { sendWhatsAppTextMessage } from '@/services/whatsapp';

export async function getCountrySubAgents(countryName: string) {
    const { rows } = await db.query("SELECT * FROM users WHERE country = $1 AND role = 'SubSuperAgent'", [countryName]);
    return rows;
}

export async function promoteToSubSuperAgent(adminId: number, targetId: number, province: string, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
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
    const { rows } = await db.query(`
        SELECT i.*, u.full_name, u.province 
        FROM super_agent_interventions i 
        JOIN users u ON i.admin_user_id = u.id 
        WHERE u.country = $1 
        ORDER BY i.created_at DESC LIMIT 100
    `, [countryName]);
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

        // 1. Vérifier le PIN et le pays de l'admin
        const { rows: adminRows } = await connection.query('SELECT pin_hash, country FROM users WHERE id = $1', [adminId]);
        if (adminRows.length === 0 || !(await bcrypt.compare(pin, adminRows[0].pin_hash))) {
            throw new Error("PIN Super Agent incorrect.");
        }
        const country = adminRows[0].country;

        // 2. Récupérer les utilisateurs cibles
        const { rows: targets } = await connection.query(
            "SELECT full_name, email, phone, first_name FROM users WHERE country = $1 AND status = 'Active'",
            [country]
        );

        if (targets.length === 0) throw new Error("Aucun utilisateur actif trouvé dans ce pays.");

        // 3. Journaliser l'action
        await logIntervention(adminId, null, 'MASS_COMMUNICATION', `Envoi massif via ${channel} à ${targets.length} utilisateurs (${country})`, connection);

        // 4. Dispatch (Asynchrone pour ne pas bloquer l'UI)
        for (const user of targets) {
            try {
                if (channel === 'sms' && user.phone) {
                    await sendSms(user.phone, message);
                } else if (channel === 'whatsapp' && user.phone) {
                    await sendWhatsAppTextMessage(user.phone, message);
                } else if (channel === 'email' && user.email) {
                    await sendEmail(user.email, subject, 'general', {
                        title: subject,
                        greeting: `Bonjour ${user.first_name || user.full_name},`,
                        message: message,
                        buttonText: 'Ouvrir CashPay',
                        buttonUrl: process.env.NEXT_PUBLIC_APP_URL,
                        signature: "Direction Générale CashPay"
                    });
                }
            } catch (err) {
                console.error(`Failed to send mass comm to ${user.email || user.phone}:`, err);
            }
        }

        await connection.query('COMMIT');
        return { success: true, count: targets.length };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function getCountryProducts(countryName: string) {
    try {
        const { rows } = await db.query(`
            SELECT p.*, u.full_name as "sellerName", b.name as "boutiqueName"
            FROM products p 
            JOIN users u ON p.agent_id = u.id 
            LEFT JOIN boutiques b ON p.boutique_id = b.id
            WHERE u.country = $1 
            ORDER BY p.created_at DESC
        `, [countryName]);
        
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
        return [];
    }
}

/**
 * Modération Marché : Active ou désactive la visibilité d'un produit.
 */
export async function toggleProductStatus(productId: string, currentStatus: boolean, adminId: number) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        
        const newStatus = !currentStatus;
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
    const { rows } = await db.query(`
        SELECT s.*, u.full_name 
        FROM subscriptions s 
        JOIN users u ON s.user_id = u.id 
        WHERE u.country = $1 AND s.status = 'pending'
        ORDER BY s.created_at DESC
    `, [countryName]);
    return rows;
}

/**
 * Récupère tous les événements en cours dans le pays de l'administrateur.
 */
export async function getCountryEvents(countryName: string) {
    try {
        const { rows } = await db.query(`
            SELECT 
                e.id, e.name, e.description, e.event_date as "date", e.event_time as "time", 
                e.location, e.status, e.currency, e.event_type as "type", e.image_url,
                u.full_name as "organizerName",
                (SELECT SUM(quantity_sold) FROM event_ticket_types WHERE event_id = e.id) as "totalSold"
            FROM events e
            JOIN users u ON e.owner_user_id = u.id
            WHERE u.country = $1
            ORDER BY e.event_date DESC
        `, [countryName]);
        return rows;
    } catch (e) {
        console.error("[getCountryEvents] Error:", e);
        return [];
    }
}

/**
 * Modération Événements : Bloque ou réactive un événement.
 */
export async function toggleEventStatus(eventId: number, currentStatus: string, adminId: number) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        
        const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
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

export async function processTvSubscription(args: any) {
    return { success: true };
}
