
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { calculateTransactionFee } from './wallet.actions';
import { createTransaction } from './transaction.actions';
import { formatUser } from '../utils';
import type { User } from '../types';

/**
 * Moteur de renouvellement automatique (À executer via Cron Job quotidien).
 * Gère le débit automatique des 30 jours et la suspension des accès.
 */
export async function processAgentSubscriptionRenewals() {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Identifier les abonnements arrivés à échéance (Validité 30 jours dépassée)
        const { rows: expiredSubs } = await connection.query(`
            SELECT s.*, u.* FROM agent_subscriptions s
            JOIN users u ON s.user_id = u.id
            WHERE s.status = 'active' AND s.current_period_end <= NOW()
        `);
        
        console.log(`[Subscription Engine] Processing ${expiredSubs.length} renewals today.`);

        for (const sub of expiredSubs) {
            const user = formatUser(sub);
            
            if (sub.auto_renew) {
                // Tenter le débit automatique
                const fee = await calculateTransactionFee(1, 'USD', 'AGENT_SUB_NORMAL', user.country, connection);
                
                const txResult = await createTransaction({
                    user, 
                    typeCode: 'AGENT_SUB', 
                    amount: fee, 
                    currency: 'USD',
                    description: 'Renouvellement automatique Abonnement Agent (30j)', 
                    metadata: { plan: 'normal', method: 'auto_renew' }, 
                    connection
                });
                
                if (txResult.success) {
                    const newEndDate = new Date();
                    newEndDate.setDate(newEndDate.getDate() + 30);
                    
                    await connection.query(`
                        UPDATE agent_subscriptions 
                        SET current_period_end = $1, is_promo_period = false, updated_at = NOW() 
                        WHERE id = $2
                    `, [newEndDate, sub.id]);
                    
                    console.log(`[Subscription Engine] Successfully renewed Agent ${user.id_wallet}`);
                } else {
                    // Échec du débit -> Suspension immédiate
                    await connection.query("UPDATE agent_subscriptions SET status = 'expired' WHERE id = $1", [sub.id]);
                    await connection.query("UPDATE users SET status = 'Suspended' WHERE id = $1", [sub.user_id]);
                    console.log(`[Subscription Engine] Renewal failed for Agent ${user.id_wallet} (No funds). Account suspended.`);
                }
            } else {
                // Pas de renouvellement automatique -> Expiration
                await connection.query("UPDATE agent_subscriptions SET status = 'expired' WHERE id = $1", [sub.id]);
                await connection.query("UPDATE users SET status = 'Suspended' WHERE id = $1", [sub.user_id]);
                console.log(`[Subscription Engine] Subscription expired for Agent ${user.id_wallet}. Manual action required.`);
            }
        }
        
        await connection.query('COMMIT');
        return { success: true };
    } catch(error) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'processing agent subscription renewals');
        return { success: false, error: dbError.error };
    } finally {
        connection.release();
    }
}
