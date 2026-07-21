'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User, Order, Product, MlmProductSettings } from '@/lib/types';
import type { PoolClient } from 'pg';
import { sendEmail } from '@/services/email';

/**
 * Enregistre un nouvel utilisateur comme partenaire de Marketing de Réseau.
 * Crée également les rangs par défaut pour ce partenaire.
 */
export async function registerMlmPartner(userId: number, companyData: any): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { companyName, companyType, productCategory, commissionCurrency, website, description, inactivityPeriod } = companyData;
        
        // Vérifier si déjà partenaire
        const { rows: existing } = await connection.query('SELECT id FROM mlm_network_partners WHERE user_id = $1', [userId]);
        if (existing.length > 0) {
            throw new Error("Vous avez déjà soumis une demande de partenariat de réseau.");
        }
        
        const payload = {
            user_id: userId,
            company_name: companyName,
            company_type: companyType,
            product_category: productCategory,
            status: 'active', // Activation directe pour faciliter les tests
            commission_currency: commissionCurrency,
            website: website,
            description: description,
            inactivity_period: inactivityPeriod || 12,
        };

        const { rows: partnerRows } = await connection.query(
            `INSERT INTO mlm_network_partners 
            (user_id, company_name, company_type, product_category, status, commission_currency, website, description, inactivity_period) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, 
            Object.values(payload)
        );
        const partnerId = partnerRows[0].id;

        // Création des rangs par défaut
        const defaultRanks = [
            { name: 'Bronze', level: 1, min_ppv: 100, min_gv: 500, min_direct: 2, comm_levels: 2 },
            { name: 'Silver', level: 2, min_ppv: 250, min_gv: 2500, min_direct: 4, comm_levels: 4 },
            { name: 'Gold', level: 3, min_ppv: 500, min_gv: 10000, min_direct: 6, comm_levels: 7 },
        ];

        for (const rank of defaultRanks) {
            await connection.query(
                'INSERT INTO mlm_ranks (partner_id, name, level, min_ppv, min_gv, min_direct_referrals, commission_levels) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [partnerId, rank.name, rank.level, rank.min_ppv, rank.min_gv, rank.min_direct, rank.comm_levels]
            );
        }

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'registering MLM partner');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

/**
 * Récupère les détails complets du partenaire MLM pour son tableau de bord.
 */
export async function getMlmPartnerDetails(userId: number): Promise<any | null> {
    try {
        const { rows } = await db.query('SELECT * FROM mlm_network_partners WHERE user_id = $1', [userId]);
        if (rows.length === 0) {
            return null;
        }
        const partner = rows[0];

        // Récupérer les produits configurés
        const { rows: products } = await db.query(`
            SELECT mps.*, p.name, (p.images->>0) as image, p.selling_price
            FROM mlm_product_settings mps
            JOIN products p ON mps.product_id = p.id
            WHERE mps.partner_id = $1
        `, [partner.id]);

        partner.products = products.map((p: any) => ({
            id: p.product_id,
            name: p.name,
            image: p.image,
            sellingPrice: parseFloat(p.selling_price),
            pv: parseFloat(p.points_volume),
            directCommission: parseFloat(p.direct_commission_percentage),
            levelCommissions: p.level_commissions,
            binaryCommission: parseFloat(p.binary_commission_percentage)
        }));
        
        // Récupérer les filleuls directs
        const { rows: directReferrals } = await db.query(`
            SELECT u.id, u.full_name, u.profile_photo, r.name as rank
            FROM mlm_network_tree tree
            JOIN users u ON tree.user_id = u.id
            LEFT JOIN mlm_ranks r ON u.mlm_rank_id = r.id
            WHERE tree.sponsor_id = $1
            LIMIT 10
        `, [userId]);

        partner.directReferrals = directReferrals;
        
        // Récupérer les rangs configurés
        const { rows: ranks } = await db.query('SELECT * FROM mlm_ranks WHERE partner_id = $1 ORDER BY level ASC', [partner.id]);
        partner.ranks = ranks;
        
        // Résumé (simulé pour l'instant)
        partner.summary = {
            networkSales: 0,
            commissions: 0,
            memberCount: directReferrals.length
        };

        return partner;
    } catch (error) {
        console.error("Error fetching MLM partner details:", error);
        return null;
    }
}

/**
 * Enregistre ou met à jour les paramètres MLM d'un produit spécifique.
 */
export async function saveMlmProductSettings(partnerId: number, settings: MlmProductSettings): Promise<{ success: boolean; error?: string }> {
    try {
        const payload = {
            partner_id: partnerId,
            product_id: parseInt(settings.productId, 10),
            points_volume: settings.pv,
            direct_commission_percentage: settings.directCommission,
            level_commissions: JSON.stringify(settings.levelCommissions),
            binary_commission_percentage: settings.binaryCommission,
        };

        await db.query(`
            INSERT INTO mlm_product_settings (partner_id, product_id, points_volume, direct_commission_percentage, level_commissions, binary_commission_percentage)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (partner_id, product_id) DO UPDATE SET
                points_volume = EXCLUDED.points_volume,
                direct_commission_percentage = EXCLUDED.direct_commission_percentage,
                level_commissions = EXCLUDED.level_commissions,
                binary_commission_percentage = EXCLUDED.binary_commission_percentage
        `, Object.values(payload));
        
        return { success: true };
    } catch(error) {
        const dbError = await handleDbError(error, 'saving MLM product settings');
        return { success: false, error: dbError.error };
    }
}

/**
 * Permet à un utilisateur de rejoindre le réseau d'un partenaire ou d'un autre membre.
 */
export async function joinNetwork(userId: number, sponsorId: number, position: 'left' | 'right'): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: existingMember } = await connection.query('SELECT user_id FROM mlm_network_tree WHERE user_id = $1', [userId]);
        if (existingMember.length > 0) {
            throw new Error('Cet utilisateur est déjà dans le réseau.');
        }

        const { rows: sponsorNode } = await connection.query('SELECT left_child_id, right_child_id FROM mlm_network_tree WHERE user_id = $1', [sponsorId]);
        if (sponsorNode.length === 0) {
            const { rows: partnerCheck } = await connection.query('SELECT id FROM mlm_network_partners WHERE user_id = $1', [sponsorId]);
            if (partnerCheck.length > 0) {
                await connection.query('INSERT INTO mlm_network_tree (user_id) VALUES ($1)', [sponsorId]);
            } else {
                throw new Error('Le parrain spécifié est introuvable dans le réseau.');
            }
        }

        const positionColumn = position === 'left' ? 'left_child_id' : 'right_child_id';
        const { rows: updatedSponsor } = await connection.query('SELECT left_child_id, right_child_id FROM mlm_network_tree WHERE user_id = $1', [sponsorId]);
        
        if (updatedSponsor[0][positionColumn]) {
            throw new Error(`La position ${position} est déjà occupée sous ce parrain.`);
        }

        await connection.query(
            'INSERT INTO mlm_network_tree (user_id, sponsor_id, binary_parent_id, binary_position) VALUES ($1, $2, $3, $4)',
            [userId, sponsorId, sponsorId, position]
        );

        await connection.query(`UPDATE mlm_network_tree SET ${positionColumn} = $1 WHERE user_id = $2`, [userId, sponsorId]);
        
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
 * Récupère la structure de l'arbre binaire pour un utilisateur (jusqu'à 3 niveaux).
 */
export async function getMlmNetworkTree(userId: number): Promise<any | null> {
    try {
        const { rows } = await db.query(`
            WITH RECURSIVE network_path AS (
                SELECT user_id, sponsor_id, binary_parent_id, binary_position, left_child_id, right_child_id, 0 as level FROM mlm_network_tree WHERE user_id = $1
                UNION ALL
                SELECT t.user_id, t.sponsor_id, t.binary_parent_id, t.binary_position, t.left_child_id, t.right_child_id, np.level + 1 FROM mlm_network_tree t JOIN network_path np ON t.user_id = np.left_child_id OR t.user_id = np.right_child_id WHERE np.level < 3
            )
            SELECT np.user_id, np.left_child_id, np.right_child_id, np.level, u.full_name as user_name, u.profile_photo, r.name as mlm_rank FROM network_path np JOIN users u ON np.user_id = u.id LEFT JOIN mlm_ranks r ON u.mlm_rank_id = r.id;
        `, [userId]);
        return rows;
    } catch(error) {
        return null;
    }
}

/**
 * Récupère l'historique des commissions pour un utilisateur.
 */
export async function getMlmCommissions(userId: number): Promise<any[]> {
    try {
        const { rows } = await db.query(`
            SELECT c.id, c.amount, c.currency, c.commission_type, c.created_at, c.level, u.full_name as source_user_name FROM mlm_commissions c LEFT JOIN users u ON c.source_user_id = u.id WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT 100;
        `, [userId]);
        return rows;
    } catch (error) {
        return [];
    }
}

/**
 * Met à jour les paramètres des rangs pour un partenaire.
 */
export async function updateRankSettings(partnerId: number, ranks: any[]): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        for (const rank of ranks) {
            const { id, name, min_ppv, min_gv, min_direct_referrals, commission_levels } = rank;
            await connection.query(`UPDATE mlm_ranks SET name = $1, min_ppv = $2, min_gv = $3, min_direct_referrals = $4, commission_levels = $5 WHERE id = $6 AND partner_id = $7`, [name, min_ppv || 0, min_gv || 0, min_direct_referrals || 0, commission_levels || 0, id, partnerId]);
        }
        await connection.query('COMMIT');
        return { success: true };
    } catch (error) {
        await connection.query('ROLLBACK');
        return { success: false, error: 'Erreur lors de la mise à jour des rangs.' };
    } finally {
        connection.release();
    }
}

/**
 * Récupère les données du tableau de bord pour un membre du réseau.
 */
export async function getMlmMemberDashboard(userId: number): Promise<any | null> {
  try {
    const { rows } = await db.query(`SELECT u.id, u.full_name, u.profile_photo, t.sponsor_id, s.full_name as sponsor_name, r.name as rank_name, r.level as rank_level, t.ppv_current_month, t.gv_current_month, t.pv_left, t.pv_right, (SELECT COUNT(*) FROM mlm_network_tree WHERE sponsor_id = u.id) as direct_referrals FROM users u JOIN mlm_network_tree t ON u.id = t.user_id LEFT JOIN users s ON t.sponsor_id = s.id LEFT JOIN mlm_ranks r ON u.mlm_rank_id = r.id WHERE u.id = $1`, [userId]);
    if (rows.length === 0) return null;
    const userData = rows[0];
    const { rows: nextRankRows } = await db.query(`SELECT * FROM mlm_ranks WHERE level > $1 ORDER BY level ASC LIMIT 1`, [userData.rank_level || 0]);
    const { rows: referrals } = await db.query(`SELECT u.id, u.full_name, u.profile_photo, r.name as rank_name FROM mlm_network_tree t JOIN users u on t.user_id = u.id LEFT JOIN mlm_ranks r on u.mlm_rank_id = r.id WHERE t.sponsor_id = $1`, [userId]);
    return { user: { name: userData.full_name, rank: userData.rank_name || 'Client', ppv: userData.ppv_current_month, gv: userData.gv_current_month }, sponsor: { name: userData.sponsor_name }, nextRank: nextRankRows[0] || null, binaryStats: { left: userData.pv_left, right: userData.pv_right }, directReferrals: referrals };
  } catch (error) {
    return null;
  }
}

/**
 * Traite une commande JoJo pour calculer et distribuer les points volume et commissions MLM.
 */
export async function processMlmOrder(order: Order): Promise<void> {
    console.log(`[MLM Processing] Starting processing for Order #${order.reference}`);
    // Cette fonction sera étendue pour parcourir l'arbre binaire et créditer les commissions réelles
}