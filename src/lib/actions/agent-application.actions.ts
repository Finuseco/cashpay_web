
'use server';

import type { User } from '@/lib/types';
import { db } from '../db';
import { handleDbError } from './helpers';
import { calculateTransactionFee } from './wallet.actions';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';

export interface AgentSubscription {
    id?: number;
    user_id?: number;
    status: 'active' | 'inactive' | 'expired' | 'cancelled';
    current_period_end: string | null;
    is_promo_period: boolean;
    auto_renew: boolean;
    full_name?: string;
    id_wallet?: string;
}

/**
 * Récupère le statut d'abonnement agent d'un utilisateur.
 */
export async function getAgentSubscription(userId: number): Promise<AgentSubscription | null> {
    try {
        const { rows } = await db.query('SELECT * FROM agent_subscriptions WHERE user_id = $1::integer', [userId]);
        if (rows.length === 0) return null;
        return {
            id: rows[0].id,
            status: rows[0].status,
            current_period_end: rows[0].current_period_end ? new Date(rows[0].current_period_end).toISOString() : null,
            is_promo_period: rows[0].is_promo_period,
            auto_renew: rows[0].auto_renew
        };
    } catch (error) {
        handleDbError(error, 'getting agent subscription');
        return null;
    }
}

/**
 * Active ou renouvelle un abonnement agent en débitant réellement le compte de l'utilisateur.
 * Calcule une période de 30 jours.
 */
export async function subscribeAsAgent(userId: number, plan: 'promo' | 'normal', pin: string): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Vérifier l'utilisateur
        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1::integer FOR UPDATE', [userId]);
        if (userRows.length === 0) throw new Error('Utilisateur non trouvé.');
        const user = userRows[0] as User;
        
        // 2. Vérifier le PIN
        const pinVerification = await verifyCurrentUserPin(pin);
        if (!pinVerification.success) {
            throw new Error(pinVerification.error || "Le code PIN est incorrect.");
        }

        // 3. Calculer les frais
        const feeCode = plan === 'promo' ? 'AGENT_SUB_PROMO' : 'AGENT_SUB_NORMAL';
        const fee = await calculateTransactionFee(1, 'USD', feeCode, user.country, connection);

        if (fee <= 0) {
            throw new Error(`Le tarif pour le plan '${plan}' n'est pas encore configuré pour votre pays.`);
        }

        // 4. Débiter le compte
        const transactionResult = await createTransaction({
            user,
            typeCode: 'AGENT_SUB',
            amount: fee,
            currency: 'USD',
            description: `Abonnement Agent (${plan}) - Validité 30 jours`,
            metadata: { plan, action: 'initial_subscription' },
            connection,
        });

        if (!transactionResult.success) {
            throw new Error(transactionResult.error || "Le paiement de l'abonnement ha échoué. Vérifiez votre solde.");
        }
        
        // 5. Calculer la date de fin (Aujourd'hui + 30 jours)
        const periodEndDate = new Date();
        periodEndDate.setDate(periodEndDate.getDate() + 30);

        // 6. Enregistrer l'abonnement
        await connection.query(`
            INSERT INTO agent_subscriptions (user_id, status, current_period_end, is_promo_period, auto_renew)
            VALUES ($1::integer, 'active', $2::timestamp, $3::boolean, true)
            ON CONFLICT (user_id) DO UPDATE SET
                status = 'active',
                current_period_end = EXCLUDED.current_period_end,
                is_promo_period = EXCLUDED.is_promo_period,
                updated_at = NOW()
        `, [userId, periodEndDate, plan === 'promo']);
        
        // 7. Mettre à jour le rôle de l'utilisateur
        await connection.query("UPDATE users SET role = 'Agent', status = 'Active' WHERE id = $1::integer", [userId]);

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        console.error('[Agent Subscription] Failure:', error.message);
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Met à jour le paramètre de renouvellement automatique de l'abonnement.
 */
export async function setAutoRenew(userId: number, autoRenew: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        const { rowCount } = await db.query(
            'UPDATE agent_subscriptions SET auto_renew = $1::boolean, updated_at = NOW() WHERE user_id = $2::integer',
            [autoRenew, userId]
        );
        if (rowCount === 0) throw new Error("Abonnement non trouvé.");
        return { success: true };
    } catch (error: any) {
        const dbError = await handleDbError(error, 'setting auto-renew');
        return { success: false, error: dbError.error || error.message };
    }
}

/**
 * Récupère tous les abonnements du pays (Pour le Super Agent).
 */
export async function getCountryAgentSubscriptions(countryName: string): Promise<AgentSubscription[]> {
    try {
        const { rows } = await db.query(`
            SELECT s.*, u.full_name, u.id_wallet 
            FROM agent_subscriptions s
            JOIN users u ON s.user_id = u.id
            WHERE u.country = $1::text
            ORDER BY s.current_period_end ASC
        `, [countryName]);
        return rows.map(r => ({
            ...r,
            current_period_end: r.current_period_end ? new Date(r.current_period_end).toISOString() : null
        }));
    } catch (error) {
        return [];
    }
}

/**
 * Force le réabonnement d'un agent par le Super Agent (Régularisation).
 */
export async function forceAgentRenewal(adminId: number, targetUserId: number, adminPin: string): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Vérifier le PIN Super Agent
        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1::integer', [adminId]);
        if (adminRows.length === 0 || !(await require('bcryptjs').compare(adminPin, adminRows[0].pin_hash))) {
            throw new Error("PIN Super Agent incorrect.");
        }

        // 2. Récupérer l'agent cible
        const { rows: agentRows } = await connection.query('SELECT * FROM users WHERE id = $1::integer', [targetUserId]);
        if (agentRows.length === 0) throw new Error("Agent cible introuvable.");
        const agent = agentRows[0];

        // 3. Procéder au débit (Tarif normal)
        const fee = await calculateTransactionFee(1, 'USD', 'AGENT_SUB_NORMAL', agent.country, connection);
        
        const tx = await createTransaction({
            user: require('@/lib/utils').formatUser(agent),
            typeCode: 'AGENT_SUB',
            amount: fee,
            currency: 'USD',
            description: 'Régularisation abonnement par Super Agent',
            metadata: { forced_by: adminId },
            connection
        });

        if (!tx.success) throw new Error("Le débit du compte de l'agent a échoué (Solde insuffisant).");

        // 4. Mettre à jour les dates
        const newEnd = new Date();
        newEnd.setDate(newEnd.getDate() + 30);

        await connection.query(`
            UPDATE agent_subscriptions 
            SET status = 'active', current_period_end = $1::timestamp, updated_at = NOW() 
            WHERE user_id = $2::integer
        `, [newEnd, targetUserId]);

        await connection.query("UPDATE users SET role = 'Agent', status = 'Active' WHERE id = $1::integer", [targetUserId]);

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}
