
'use server';

import { db } from '@/lib/db';
import type { PoolClient } from 'pg';
import { headers } from 'next/headers';

/**
 * Valide si un administrateur a le droit d'intervenir sur un utilisateur cible.
 * Respecte la hiérarchie National (SuperAgent) vs Provincial (SubSuperAgent).
 */
export async function validateSuperAgentAccess(adminId: number, targetUserId: number, connection?: PoolClient) {
    const conn = connection || await db.getConnection();
    try {
        const { rows: adminRows } = await conn.query('SELECT role, country, province FROM users WHERE id = $1::integer', [adminId]);
        if (adminRows.length === 0) throw new Error("Super Agent non trouvé.");
        const admin = adminRows[0];

        if (admin.role === 'Admin') return true;

        const { rows: targetRows } = await conn.query('SELECT country, province FROM users WHERE id = $1::integer', [targetUserId]);
        if (targetRows.length === 0) throw new Error("Utilisateur cible non trouvé.");
        const target = targetRows[0];

        if (admin.role === 'SuperAgent') {
            if (admin.country !== target.country) {
                throw new Error("Action interdite : Le client n'est pas dans votre juridiction nationale.");
            }
        } 
        else if (admin.role === 'SubSuperAgent') {
            if (admin.country !== target.country || admin.province !== target.province) {
                throw new Error(`Action interdite : Le client appartient à la province ${target.province}. Vous ne gérez que ${admin.province}.`);
            }
        } else {
            throw new Error("Accès refusé : Droits de gestionnaire insuffisants.");
        }
        return true;
    } finally {
        if (!connection) (conn as PoolClient).release();
    }
}

/**
 * Enregistre une trace d'intervention dans la table d'audit.
 */
export async function logIntervention(adminId: number, targetUserId: number | null, actionType: string, detail: string, connection?: PoolClient) {
    const conn = connection || await db.getConnection();
    const headerList = headers();
    const ip = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();

    try {
        await conn.query(
            `INSERT INTO super_agent_interventions (admin_user_id, target_user_id, action_type, detail, ip_address) 
             VALUES ($1::integer, $2::integer, $3::text, $4::text, $5::text)`,
            [adminId, targetUserId, actionType, detail, ip]
        ).catch(err => {
            console.warn("[logIntervention] Failed to write IP to audit. Table schema might be old.", err.message);
            // Fallback sans IP si la colonne manque
            return conn.query(
                'INSERT INTO super_agent_interventions (admin_user_id, target_user_id, action_type, detail) VALUES ($1::integer, $2::integer, $3::text, $4::text)',
                [adminId, targetUserId, actionType, detail]
            );
        });
    } finally {
        if (!connection) (conn as PoolClient).release();
    }
}

/**
 * Génère un identifiant de portefeuille unique avec le préfixe Agence 02 (Enrôlement Agent).
 */
export async function generateAgencyWalletId(countryCode: string, connection: PoolClient): Promise<string> {
    const prefix = `${countryCode.toUpperCase()}02`;
    const { rows } = await connection.query(
        "SELECT id_wallet FROM users WHERE id_wallet LIKE $1::text || '%' ORDER BY id_wallet DESC LIMIT 1 FOR UPDATE",
        [prefix]
    );

    let nextNumericPart = 1;
    if (rows.length > 0) {
        const lastWalletId = rows[0].id_wallet;
        const lastNumericPart = parseInt(lastWalletId.substring(4), 10);
        nextNumericPart = lastNumericPart + 1;
    }

    return `${prefix}${nextNumericPart.toString().padStart(8, '0')}`;
}
