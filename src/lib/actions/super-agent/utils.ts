
'use server';

import { db } from '@/lib/db';
import type { PoolClient } from 'pg';
import { assertManagedUser, requireSuperAgent } from '@/lib/super-agent-access';

/**
 * Valide si un administrateur a le droit d'intervenir sur un utilisateur cible.
 * Respecte la hiérarchie National (SuperAgent) vs Provincial (SubSuperAgent).
 */
export async function validateSuperAgentAccess(adminId: number, targetUserId: number, connection?: PoolClient) {
    await assertManagedUser(adminId, targetUserId, connection);
    return true;
}

/**
 * Enregistre une trace d'intervention dans la table d'audit.
 */
export async function logIntervention(adminId: number, targetUserId: number | null, actionType: string, detail: string, connection?: PoolClient) {
    await requireSuperAgent(adminId, connection);
    const conn = connection || await db.getConnection();
    try {
        await conn.query('INSERT INTO super_agent_interventions (admin_user_id, target_user_id, action_type, detail) VALUES ($1,$2,$3,$4)', [adminId, targetUserId, actionType, detail]);
    } finally { if (!connection) (conn as PoolClient).release(); }
}

/**
 * Génère un identifiant de portefeuille unique avec le préfixe Agence 02 (Enrôlement Agent).
 */
export async function generateAgencyWalletId(countryCode: string, connection: PoolClient): Promise<string> {
    await requireSuperAgent(undefined, connection);
    const prefix = `${countryCode.toUpperCase()}02`;
    await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', [prefix]);
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
