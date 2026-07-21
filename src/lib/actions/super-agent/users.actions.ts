
'use server';

import { db } from '@/lib/db';
import { handleDbError, saveBase64Image, getUserFromDb } from '../helpers';
import type { User } from '@/lib/types';
import { formatUser } from '@/lib/utils';
import * as bcrypt from 'bcryptjs';
import { countries } from '@/lib/countries';
import { validateSuperAgentAccess, logIntervention, generateAgencyWalletId } from './utils';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import crypto from 'crypto';

/**
 * Recherche des utilisateurs restreinte au territoire de l'admin.
 * Corrigé pour une indexation précise des paramètres SQL.
 */
export async function searchCountryUsers(adminId: number, query: string): Promise<User[]> {
    try {
        const { rows: adminRows } = await db.query('SELECT role, country, province FROM users WHERE id = $1::integer', [adminId]);
        if (adminRows.length === 0) return [];
        const admin = adminRows[0];

        let sql = `SELECT * FROM users WHERE country = $1`;
        const params: any[] = [admin.country];
        let paramIndex = 2;

        if (admin.role === 'SubSuperAgent' && admin.province) {
            sql += ` AND province = $${paramIndex++}`;
            params.push(admin.province);
        }

        if (query && query.trim() !== '') {
            const searchPattern = `%${query.trim()}%`;
            // Pour plus de robustesse avec pg, on utilise un paramètre unique pour chaque condition si nécessaire
            // ou on s'assure que le paramètre répété est bien géré.
            sql += ` AND (full_name ILIKE $${paramIndex} OR id_wallet ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(searchPattern);
        }

        sql += ` ORDER BY created_at DESC LIMIT 50`;

        const { rows } = await db.query(sql, params);
        
        // Sécurisation du mapping pour éviter qu'une ligne corrompue ne bloque toute la liste
        return rows.map(row => {
            try {
                return formatUser(row);
            } catch (e) {
                console.error("[searchCountryUsers] Error formatting user row:", row.id, e);
                return null;
            }
        }).filter(Boolean) as User[];

    } catch (error) {
        console.error("[searchCountryUsers] SQL Error:", error);
        return [];
    }
}

/**
 * Récupère les détails KYC confidentiels incluant les images de pièces d'identité.
 */
export async function getClientKycDetails(targetUserId: number, adminId: number): Promise<any> {
    try {
        const { rows: userRows } = await db.query('SELECT signature_image, representative, phone, email, id_wallet, profile_photo FROM users WHERE id = $1::integer', [targetUserId]);
        if (userRows.length === 0) return null;
        
        const { rows: docRows } = await db.query('SELECT * FROM user_documents WHERE user_id = $1::integer ORDER BY created_at DESC LIMIT 1', [targetUserId]);
        
        return {
            signature_image: userRows[0]?.signature_image,
            representative: typeof userRows[0]?.representative === 'string' ? JSON.parse(userRows[0].representative) : userRows[0]?.representative,
            id_wallet: userRows[0]?.id_wallet,
            profile_photo: userRows[0]?.profile_photo,
            document: docRows[0] || null
        };
    } catch (error) {
        return null;
    }
}

/**
 * Met à jour la photo de profil d'un client par un agent.
 */
export async function updateClientProfilePhoto(targetUserId: number, adminId: number, base64Image: string, adminPin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        
        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1::integer', [adminId]);
        if (!(await bcrypt.compare(adminPin, adminRows[0].pin_hash))) throw new Error("PIN Admin incorrect.");

        const savedPath = await saveBase64Image(base64Image, 'avatars', `user_upd_${targetUserId}_${Date.now()}`);
        if (!savedPath) throw new Error("Erreur lors de l'enregistrement de l'image.");

        await connection.query('UPDATE users SET profile_photo = $1 WHERE id = $2::integer', [savedPath, targetUserId]);
        await logIntervention(adminId, targetUserId, 'PHOTO_UPDATE', 'Mise à jour manuelle de la photo de profil', connection);

        await connection.query('COMMIT');
        return { success: true, path: savedPath };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}

/**
 * Surclasse un compte client en compte Partenaire Business / B2B avec clés API (Live et Test).
 * Le nom de l'utilisateur est remplacé par le nom de l'entreprise.
 */
export async function upgradeToBusinessAccount(targetUserId: number, adminId: number, companyName: string, adminPin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        
        // 1. Vérifier le PIN Admin
        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1::integer', [adminId]);
        if (!(await bcrypt.compare(adminPin, adminRows[0].pin_hash))) throw new Error("PIN Admin incorrect.");

        // Génération des clés de production
        const apiKey = `cp_live_${crypto.randomBytes(12).toString('hex')}`;
        const apiSecret = `csk_live_${crypto.randomBytes(24).toString('hex')}`;

        // GÉNÉRATION DES CLÉS DE TEST (SANDBOX)
        const testApiKey = `cp_test_${crypto.randomBytes(12).toString('hex')}`;
        const testApiSecret = `csk_test_${crypto.randomBytes(24).toString('hex')}`;

        // 2. Mettre à jour l'utilisateur : rôle, type, NOM (Company Name) et les 4 clés (Live + Test)
        await connection.query(`
            UPDATE users 
            SET role = 'PartnerB2B', 
                account_type = 'business',
                full_name = $1,
                api_key = $2, 
                api_secret = $3,
                test_api_key = $4,
                test_api_secret = $5
            WHERE id = $6::integer
        `, [companyName, apiKey, apiSecret, testApiKey, testApiSecret, targetUserId]);

        // 3. Créer ou mettre à jour l'entrée dans b2b_partners
        const { rows: userRows } = await connection.query('SELECT email, id_wallet FROM users WHERE id = $1::integer', [targetUserId]);
        const user = userRows[0];

        await connection.query(`
            INSERT INTO b2b_partners (owner_user_id, company_name, company_email, status, api_key)
            VALUES ($1, $2, $3, 'active', $4)
            ON CONFLICT (owner_user_id) DO UPDATE SET 
                company_name = EXCLUDED.company_name,
                status = 'active', 
                api_key = EXCLUDED.api_key
        `, [targetUserId, companyName, user.email, apiKey]);

        await logIntervention(adminId, targetUserId, 'ROLE_UPGRADE_B2B', `Surclassement B2B (Live & Test) : Identité changée en "${companyName}"`, connection);

        await connection.query('COMMIT');
        
        if (user.email) {
            await sendEmail(user.email, `Bienvenue chez CashPay All International, ${companyName}`, 'b2b_welcome', {
                companyName: companyName,
                apiKey: apiKey,
                testApiKey: testApiKey,
                testApiSecret: testApiSecret,
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
            });
        }

        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}

export async function updateClientContact(args: { targetUserId: number, adminId: number, pin: string, newPhone?: string, newEmail?: string }) {
    const { targetUserId, adminId, pin, newPhone, newEmail } = args;
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await validateSuperAgentAccess(adminId, targetUserId, connection);

        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1::integer', [adminId]);
        if (adminRows.length === 0 || !(await bcrypt.compare(pin, adminRows[0].pin_hash))) throw new Error("PIN admin incorrect.");

        if (newPhone) {
            await connection.query('UPDATE users SET phone = $1 WHERE id = $2::integer', [newPhone, targetUserId]);
            await logIntervention(adminId, targetUserId, 'PHONE_UPDATE', `Changement de téléphone vers ${newPhone}`, connection);
        }
        if (newEmail) {
            await connection.query('UPDATE users SET email = $1 WHERE id = $2::integer', [newEmail, targetUserId]);
            await logIntervention(adminId, targetUserId, 'EMAIL_UPDATE', `Changement d'email vers ${newEmail}`, connection);
        }

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function resetClientPin(targetUserId: number, adminId: number): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await validateSuperAgentAccess(adminId, targetUserId, connection);
        
        const { rows } = await connection.query('SELECT phone FROM users WHERE id = $1::integer', [targetUserId]);
        if (rows.length === 0) throw new Error("Client non trouvé.");
        
        const newPin = Math.floor(1000 + Math.random() * 9000).toString();
        const pinHash = await bcrypt.hash(newPin, 10);
        await connection.query('UPDATE users SET pin_hash = $1 WHERE id = $2::integer', [pinHash, targetUserId]);
        
        if (rows[0].phone) {
            await sendSms(rows[0].phone, `CashPay Security: Votre nouveau code PIN de sécurité généré par agent est : ${newPin}.`);
        }
        
        await logIntervention(adminId, targetUserId, 'PIN_RESET', 'Réinitialisation forcée du PIN client', connection);
        
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function toggleUserStatus(targetUserId: number, currentStatus: string, adminId: number, reason?: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await validateSuperAgentAccess(adminId, targetUserId, connection);
        
        const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
        const finalReason = newStatus === 'Suspended' ? (reason || "Suspension administrative") : null;

        await connection.query('UPDATE users SET status = $1, suspension_reason = $2 WHERE id = $3::integer', [newStatus, finalReason, targetUserId]);
        
        await logIntervention(adminId, targetUserId, 'STATUS_TOGGLE', `Changement de statut vers ${newStatus}. Raison: ${finalReason || 'N/A'}`, connection);
        
        await connection.query('COMMIT');
        return { success: true, status: newStatus };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}
