

'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { createTransaction } from './transaction.actions';

export interface PublisherAnalyticsData {
    summary: {
        impressions: number;
        clicks: number;
        revenue: number; // For simplicity, we'll calculate a mock revenue
    };
    performanceByDay: {
        date: string;
        impressions: number;
        clicks: number;
    }[];
    topCountries: {
        country: string;
        impressions: number;
    }[];
}

const COST_PER_CLICK = 0.05; // $0.05 per click, example value
const SHARE_FOR_PUBLISHER = 0.70; // Publisher gets 70% of the CPC revenue

/**
 * Fetches and calculates analytics data for a specific publisher.
 * @param publisherUserId The user ID of the publisher.
 * @returns A promise that resolves with the analytics data.
 */
export async function getPublisherAnalyticsData(publisherUserId: number): Promise<PublisherAnalyticsData | null> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 1. Fetch Summary Data (Impressions & Clicks) for the last 30 days that have not been claimed yet
        const { rows: summaryRows } = await connection.query(`
            SELECT 
                event_type,
                COUNT(*) as count
            FROM ad_logs
            WHERE placement_id IN (SELECT id FROM ad_placements WHERE blogger_user_id = $1)
            AND timestamp >= $2
            AND is_claimed = false
            GROUP BY event_type
        `, [publisherUserId, thirtyDaysAgo]);

        const summary: { view: number; click: number } = summaryRows.reduce((acc, row) => {
            const eventType = row.event_type as 'view' | 'click';
            if (eventType === 'view' || eventType === 'click') {
                acc[eventType] = Number(row.count);
            }
            return acc;
        }, { view: 0, click: 0 });

        const revenue = (summary.click || 0) * COST_PER_CLICK * SHARE_FOR_PUBLISHER;

        // 2. Fetch Performance by Day
        const { rows: dailyRows } = await connection.query(`
            SELECT 
                TO_CHAR(timestamp, 'YYYY-MM-DD') as date,
                SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as impressions,
                SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks
            FROM ad_logs
            WHERE placement_id IN (SELECT id FROM ad_placements WHERE blogger_user_id = $1)
            AND timestamp >= $2
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `, [publisherUserId, thirtyDaysAgo]);

        const performanceByDay = dailyRows.map(row => ({
            date: new Date(row.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
            impressions: Number(row.impressions),
            clicks: Number(row.clicks),
        }));

        // 3. Fetch Top Countries
        const { rows: countryRows } = await connection.query(`
            SELECT 
                country_code as country,
                COUNT(*) as impressions
            FROM ad_logs
            WHERE placement_id IN (SELECT id FROM ad_placements WHERE blogger_user_id = $1)
            AND timestamp >= $2 AND country_code IS NOT NULL AND country_code != ''
            GROUP BY country_code
            ORDER BY impressions DESC
            LIMIT 5
        `, [publisherUserId, thirtyDaysAgo]);

        await connection.query('COMMIT');

        return {
            summary: {
                impressions: summary.view || 0,
                clicks: summary.click || 0,
                revenue: revenue
            },
            performanceByDay: performanceByDay,
            topCountries: countryRows.map(row => ({ country: row.country, impressions: Number(row.impressions) })),
        };

    } catch (error) {
        await connection.query('ROLLBACK');
        await handleDbError(error, 'fetching publisher analytics data');
        return null;
    } finally {
        connection.release();
    }
}


export async function claimPublisherEarnings(
    publisherUserId: number, 
    claimType: 'claim' | 'double' | 'triple', 
    baseAmount: number
): Promise<{ success: boolean; message: string; error?: string }> {
    if (baseAmount < 70) {
        return { success: false, message: 'Le montant minimum pour réclamer est de 70 USD.', error: 'Le montant minimum pour réclamer est de 70 USD.' };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        let finalAmount = 0;
        let message = '';
        const randomChance = Math.random();

        if (claimType === 'claim') {
            finalAmount = baseAmount;
            message = `Félicitations ! ${finalAmount.toFixed(2)} USD ont été transférés vers votre portefeuille principal.`;
        } else if (claimType === 'double') {
            if (randomChance < 0.5) { // 50% chance
                finalAmount = baseAmount * 2;
                message = `Incroyable ! Vous avez doublé vos gains ! ${finalAmount.toFixed(2)} USD ont été ajoutés à votre portefeuille.`;
            } else {
                finalAmount = 0;
                message = "Dommage... Vous avez perdu vos gains cette fois-ci. Plus de chance la prochaine fois !";
            }
        } else if (claimType === 'triple') {
             if (randomChance < 0.33) { // 33% chance
                finalAmount = baseAmount * 3;
                message = `Jackpot ! Vous avez triplé la mise ! ${finalAmount.toFixed(2)} USD ont été ajoutés à votre portefeuille.`;
            } else {
                finalAmount = 0;
                message = "Pas de chance... La targuette n'a pas abouti. Vos gains ont été perdus.";
            }
        }
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        await connection.query(
            `UPDATE ad_logs SET is_claimed = true 
             WHERE placement_id IN (SELECT id FROM ad_placements WHERE blogger_user_id = $1)
             AND timestamp >= $2`,
            [publisherUserId, thirtyDaysAgo]
        );

        if (finalAmount > 0) {
            const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [publisherUserId]);
            if (userRows.length === 0) throw new Error("Utilisateur éditeur introuvable.");

            await createTransaction({
                user: userRows[0] as any,
                typeCode: 'PUB_EARN',
                amount: finalAmount,
                currency: 'USD',
                description: `Gains publicitaires réclamés (${claimType})`,
                metadata: { baseAmount, claimType },
                connection,
            });
        }
        
        await connection.query('COMMIT');
        return { success: true, message };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'claiming publisher earnings');
        return { success: false, error: dbError.error || error.message, message: dbError.error || error.message };
    } finally {
        connection.release();
    }
}
