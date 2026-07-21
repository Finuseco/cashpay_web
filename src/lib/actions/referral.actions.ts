
'use server';

import type { Referral, User } from '@/lib/types';
import { db } from '../db';
import { handleDbError } from './helpers';
import type { PoolClient } from 'pg';
import { createTransaction } from './transaction.actions';
import { getAuthenticatedUser } from './user.actions';

/**
 * Récupère la liste des filleuls d'un utilisateur avec leur statut d'activité et de réclamation.
 */
export async function getReferralsForUser(userId: number): Promise<Referral[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                r.id, 
                u.full_name as "fullName", 
                r.status, 
                r.created_at as date,
                r.is_claimed as "isClaimed"
            FROM referrals r
            JOIN users u ON r.referred_user_id = u.id
            WHERE r.referrer_user_id = $1
            ORDER BY r.created_at DESC
        `, [userId]);
        
        return rows.map(row => ({
            id: row.id,
            fullName: row.fullName,
            status: row.status,
            date: new Date(row.date).toISOString().split('T')[0],
            isClaimed: Boolean(row.isClaimed)
        }));
    } catch (error) {
        handleDbError(error, 'fetching referrals');
        return [];
    }
}

/**
 * Action pour réclamer la récompense d'un parrainage spécifique.
 */
export async function claimReferralReward(referralId: number): Promise<{ success: boolean; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié." };

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Vérifier l'éligibilité du parrainage
        const { rows: refRows } = await connection.query(
            `SELECT * FROM referrals WHERE id = $1 AND referrer_user_id = $2 FOR UPDATE`,
            [referralId, user.id]
        );

        if (refRows.length === 0) throw new Error("Parrainage introuvable.");
        const referral = refRows[0];

        if (referral.status !== 'Active') {
            throw new Error("Ce filleul n'a pas encore activé son compte par un mouvement financier.");
        }
        if (referral.is_claimed) {
            throw new Error("La récompense pour ce parrainage a déjà été récupérée.");
        }

        // 2. Récupérer le taux de conversion
        const { rows: settingsRows } = await connection.query(
            `SELECT point_value, currency_code FROM referral_settings WHERE country_code = $1`,
            [user.country || 'CD']
        );
        const settings = settingsRows[0] || { point_value: 100, currency_code: 'CDF' };

        // 3. Créer la transaction de crédit
        const rewardAmount = parseFloat(settings.point_value);
        const txResult = await createTransaction({
            user,
            typeCode: 'REF_REWARD',
            amount: rewardAmount,
            currency: settings.currency_code,
            description: `Récompense de parrainage (Filleul #${referral.referred_user_id})`,
            metadata: { referralId },
            status: 'Completed',
            connection
        });

        if (!txResult.success) throw new Error(txResult.error || "Échec du crédit de la récompense.");

        // 4. Marquer comme réclamé
        await connection.query(`UPDATE referrals SET is_claimed = true WHERE id = $1`, [referralId]);

        await connection.query('COMMIT');
        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Met à jour le statut du parrainage lors de n'importe quel premier mouvement créditeur du filleul.
 */
export async function updateReferralStatusOnDeposit(userId: number, connection: PoolClient) {
    try {
        const { rows: referralRows } = await connection.query(
            `SELECT id, referrer_user_id FROM referrals WHERE referred_user_id = $1 AND status = $2`,
            [userId, 'Pending Deposit']
        );

        if (referralRows.length === 0) return;
        
        // Vérifier s'il y a au moins un mouvement financier réussi sur le compte (crédit)
        const { rows: activityRows } = await connection.query(
            `SELECT COUNT(*) as "count" FROM transactions WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'Completed'`,
            [userId]
        );
        
        if (parseInt(activityRows[0].count) >= 1) {
            console.log(`[Referral] Financial activity detected for user ${userId}. Activating referral.`);
            await connection.query('UPDATE referrals SET status = $1 WHERE referred_user_id = $2', ['Active', userId]);
        }
    } catch (error) {
        console.error(`Error during referral status update for user ${userId}:`, error);
    }
}

export async function getReferralConversionRate(countryCode: string | null): Promise<number | null> {
  try {
    const { rows } = await db.query(
      'SELECT point_value FROM referral_settings WHERE country_code = $1',
      [countryCode || 'CD']
    );
    return rows.length > 0 ? parseFloat(rows[0].point_value) : 100;
  } catch (error) {
    return 100;
  }
}
