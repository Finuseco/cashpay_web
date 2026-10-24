'use server';

import type { MonPaysCompany, MonPaysActivity, User } from '../types';
import { db } from '@/lib/db';
import { handleDbError, saveBase64Image, getUserFromDb } from './helpers';
import { verifyCurrentUserPin } from './auth.actions';
import { createTransaction } from './transaction.actions';
import { calculateTransactionFee } from './wallet.actions';
import { formatUser, countryToCode } from '../utils';
import type { PoolClient } from 'pg';
import crypto from 'crypto';
import { getLocalCurrency } from './currency.actions';

/**
 * L'identité vient de la session : un identifiant envoyé par le navigateur n'est accepté
 * que s'il correspond à l'utilisateur connecté.
 */
async function sessionUserIdOrNull(claimedUserId?: number | null): Promise<number | null> {
    const { getAuthenticatedUser } = await import('./user.actions');
    const me = await getAuthenticatedUser();
    if (!me) return null;
    if (claimedUserId != null && Number(claimedUserId) !== Number(me.id)) return null;
    return Number(me.id);
}

/**
 * Crédite la récompense MonPays (PUB_EARN, budget en CDF) dans la devise locale de l'utilisateur
 * lorsque le taux de son pays est configuré ; sinon en CDF.
 */
async function creditShareReward(user: User, reward: number, description: string, metadata: Record<string, any>, connection: PoolClient) {
    let localCode: string | undefined;
    try {
        const local = await getLocalCurrency(user);
        if (local?.code && local.code !== 'CDF') localCode = local.code;
    } catch { /* devise locale indisponible : CDF */ }

    if (localCode) {
        const converted = await createTransaction({
            user, typeCode: 'PUB_EARN', amount: reward, currency: 'CDF', sourceCurrency: localCode,
            description, metadata, connection,
        });
        if (converted.success) return converted;
    }
    return createTransaction({ user, typeCode: 'PUB_EARN', amount: reward, currency: 'CDF', description, metadata, connection });
}

/**
 * Récupère toutes les entreprises vérifiées.
 */
export async function getCompanies(): Promise<MonPaysCompany[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                mc.id,
                mc.company_name as name, 
                mc.logo_url as "logoUrl", 
                mc.cover_photo_url as "bannerUrl", 
                mc.description,
                mc.status,
                mc.category,
                mc.country as "countryCode",
                mc.owner_wallet_id as "ownerWalletId",
                mc.owner_user_id as "ownerUserId"
            FROM monpays_companies mc 
            WHERE mc.status = 'verified'
            ORDER BY mc.company_name ASC
        `);
        return rows.map(row => ({
            id: row.id.toString(),
            name: row.name,
            logoUrl: row.logoUrl,
            bannerUrl: row.bannerUrl,
            description: row.description,
            isVerified: row.status === 'verified',
            category: row.category,
            countryCode: row.countryCode,
            ownerWalletId: row.ownerWalletId,
            ownerUserId: row.ownerUserId != null ? Number(row.ownerUserId) : undefined
        })) as MonPaysCompany[];
    } catch (error) {
        console.error("Failed to fetch MonPays companies:", error);
        return [];
    }
}

/**
 * Récupère une entreprise par son ID.
 */
export async function getCompanyById(id: string): Promise<MonPaysCompany | null> {
    try {
        const { rows } = await db.query(`
            SELECT 
                mc.*,
                mc.company_name as name, 
                mc.logo_url as "logoUrl", 
                mc.cover_photo_url as "bannerUrl", 
                mc.website_url as website,
                mc.owner_wallet_id as "ownerWalletId" 
            FROM monpays_companies mc 
            WHERE mc.id = $1`, [id]);

        if (rows.length === 0) return null;

        const row = rows[0];
        return {
            id: row.id.toString(),
            name: row.name,
            description: row.description,
            logoUrl: row.logoUrl,
            bannerUrl: row.bannerUrl,
            website: row.website,
            address: row.address,
            phone: row.phone,
            email: row.email,
            ownerWalletId: row.ownerWalletId,
            ownerUserId: row.owner_user_id != null ? Number(row.owner_user_id) : undefined,
            category: row.category,
            countryCode: row.country, 
            isVerified: row.status === 'verified',
        } as MonPaysCompany;
    } catch (error) {
        return null;
    }
}

/**
 * Récupère les activités avec les données de monétisation réelles.
 */
export async function getActivities(): Promise<MonPaysActivity[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                p.id, 
                p.author_company_id as "companyId",
                p.content as description,
                p.media_url as "imageUrl",
                p.created_at as "createdAt",
                p.is_monetized as "isMonetized",
                p.reward_per_share as "rewardPerShare",
                p.monetization_budget as "monetizationBudget",
                p.views_count as "viewsCount",
                mc.company_name as "companyName",
                mc.owner_wallet_id as "ownerWalletId",
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes,
                (SELECT COUNT(*) FROM post_shares WHERE post_id = p.id) as shares
            FROM monpays_posts p
            JOIN monpays_companies mc ON p.author_company_id = mc.id
            WHERE p.status = 'published'
            ORDER BY p.created_at DESC
        `);
        return rows.map(row => ({
            id: row.id.toString(),
            companyId: row.companyId.toString(),
            title: row.companyName,
            description: row.description,
            imageUrl: row.imageUrl,
            createdAt: new Date(row.createdAt).toISOString(),
            likes: Number(row.likes),
            shares: Number(row.shares),
            views: Number(row.viewsCount || 0),
            isMonetized: Boolean(row.isMonetized),
            rewardPerShare: parseFloat(row.rewardPerShare || '0'),
            monetizationBudget: parseFloat(row.monetizationBudget || '0'),
            ownerWalletId: row.ownerWalletId
        })) as MonPaysActivity[];
    } catch (error) {
        console.error("Failed to fetch MonPays activities:", error);
        return [];
    }
}

export async function toggleFollowCompany(userId: number, companyId: number) {
    try {
        const sid = await sessionUserIdOrNull(userId);
        if (sid === null) return { success: false };
        userId = sid;
        const { rows: exists } = await db.query('SELECT 1 FROM company_followers WHERE user_id = $1 AND company_id = $2', [userId, companyId]);
        if (exists.length > 0) {
            await db.query('DELETE FROM company_followers WHERE user_id = $1 AND company_id = $2', [userId, companyId]);
            return { success: true, isFollowing: false };
        } else {
            await db.query('INSERT INTO company_followers (user_id, company_id) VALUES ($1, $2)', [userId, companyId]);
            return { success: true, isFollowing: true };
        }
    } catch (e) { return { success: false }; }
}

export async function getCompanyFollowerInfo(userId: number | undefined, companyId: number) {
    try {
        const { rows: count } = await db.query('SELECT COUNT(*) FROM company_followers WHERE company_id = $1', [companyId]);
        let isFollowing = false;
        if (userId) {
            const { rows = [] } = await db.query('SELECT 1 FROM company_followers WHERE user_id = $1 AND company_id = $2', [userId, companyId]);
            isFollowing = rows.length > 0;
        }
        return { followerCount: parseInt(count[0].count), isFollowing };
    } catch (e) { return { followerCount: 0, isFollowing: false }; }
}

export async function postMonPaysComment(postId: number, userId: number, content: string) {
    try {
        const sid = await sessionUserIdOrNull(userId);
        const text = (content || '').trim().slice(0, 2000);
        if (sid === null || !text) return { success: false };
        userId = sid;
        content = text;
        await db.query('INSERT INTO monpays_comments (post_id, user_id, content) VALUES ($1, $2, $3)', [postId, userId, content]);
        return { success: true };
    } catch (e) { return { success: false }; }
}

export async function getMonPaysComments(postId: number) {
    try {
        const { rows } = await db.query(`
            SELECT c.*, u.full_name as "userName", u.profile_photo as "userPhoto"
            FROM monpays_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = $1
            ORDER BY c.created_at DESC
        `, [postId]);
        return rows;
    } catch (e) { return []; }
}

export async function recordPageVisit(companyId: number, userId?: number | null) {
    try {
        await db.query(
            'INSERT INTO monpays_page_visits (company_id, user_id) VALUES ($1, $2)',
            [companyId, userId || null]
        );
    } catch (e) {
        console.error("Failed to record page visit", e);
    }
}

export async function getCompanyAnalytics(userId: number): Promise<any> {
    try {
        const { rows: companyRows } = await db.query('SELECT * FROM monpays_companies WHERE owner_user_id = $1', [userId]);
        if (companyRows.length === 0) return null;
        const company = companyRows[0];

        const { rows: visitRows } = await db.query(`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM-DD') as date,
                COUNT(*) as count
            FROM monpays_page_visits
            WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY date ORDER BY date ASC
        `, [company.id]);

        const { rows: postStats } = await db.query(`
            SELECT 
                SUM(views_count) as "totalViews",
                (SELECT COUNT(*) FROM post_likes WHERE post_id IN (SELECT id FROM monpays_posts WHERE author_company_id = $1)) as "totalLikes",
                (SELECT COUNT(*) FROM post_shares WHERE post_id IN (SELECT id FROM monpays_posts WHERE author_company_id = $1)) as "totalShares"
            FROM monpays_posts
            WHERE author_company_id = $1
        `, [company.id]);

        const { rows: budgetRows } = await db.query(`
            SELECT 
                SUM(monetization_budget) as "remainingBudget",
                (SELECT SUM(amount_earned) FROM post_shares WHERE post_id IN (SELECT id FROM monpays_posts WHERE author_company_id = $1)) as "spentBudget"
            FROM monpays_posts
            WHERE author_company_id = $1 AND is_monetized = true
        `, [company.id]);

        return {
            company,
            stats: {
                pageVisits: Number(visitRows.reduce((a, b) => a + Number(b.count), 0)),
                postViews: Number(postStats[0]?.totalViews || 0),
                postLikes: Number(postStats[0]?.totalLikes || 0),
                postShares: Number(postStats[0]?.totalShares || 0),
            },
            budget: {
                remaining: parseFloat(budgetRows[0]?.remainingBudget || '0'),
                spent: parseFloat(budgetRows[0]?.spentBudget || '0')
            },
            history: visitRows
        };
    } catch (error) {
        console.error("Analytics fetch failed", error);
        return null;
    }
}

export async function promoteToAdsNetwork(args: { user: User, postId: string, budget: number, pin: string }) {
    const { postId, budget, pin } = args;
    
    const pinRes = await verifyCurrentUserPin(pin);
    if (!pinRes.success) return pinRes;

    const { getAuthenticatedUser } = await import('./user.actions');
    const user = await getAuthenticatedUser();
    if (!user || (args.user?.id && Number(args.user.id) !== Number(user.id))) return { success: false, error: 'Session invalide.' };
    if (!Number.isFinite(Number(budget)) || Number(budget) <= 0) return { success: false, error: 'Budget invalide.' };

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: postRows } = await connection.query('SELECT * FROM monpays_posts WHERE id = $1', [postId]);
        if (postRows.length === 0) throw new Error("Publication introuvable.");
        const post = postRows[0];

        const tx = await createTransaction({
            user, typeCode: 'AD_FEE', amount: budget, currency: 'USD',
            description: `Promotion Ads Network pour Post MonPays #${postId}`,
            metadata: { postId },
            connection
        });

        if (!tx.success) throw new Error(tx.error);

        const { rows: companyRows } = await connection.query('SELECT company_name FROM monpays_companies WHERE id = $1', [post.author_company_id]);
        
        await connection.query(
            'INSERT INTO ad_campaigns (user_id, name, target_url, image_url, format, budget, duration_days, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [user.id, `Boost - ${companyRows[0].company_name}`, `${process.env.NEXT_PUBLIC_APP_URL}/monpays/platform/${postId}`, post.media_url, 'banner', budget, 30, 'active']
        );

        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

export async function initiateTrackedShare(postId: string, userId: number, platform: string): Promise<{ success: boolean; trackingId?: string; shareUrl?: string; error?: string }> {
    const id = parseInt(postId, 10);
    try {
        const sid = await sessionUserIdOrNull(userId);
        if (sid === null) return { success: false, error: 'Veuillez vous reconnecter.' };
        userId = sid;
        const { rows: existing } = await db.query(
            'SELECT tracking_id FROM post_shares WHERE post_id = $1 AND user_id = $2 AND platform = $3',
            [id, userId, platform]
        );

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.cashpay-all.com';

        if (existing.length > 0) {
            const trackingId = existing[0].tracking_id;
            return { success: true, trackingId, shareUrl: `${baseUrl}/monpays/share/${trackingId}` };
        }

        const trackingId = crypto.randomBytes(8).toString('hex');
        
        await db.query(
            'INSERT INTO post_shares (post_id, user_id, platform, tracking_id, is_paid) VALUES ($1, $2, $3, $4, false)',
            [id, userId, platform, trackingId]
        );

        const trackedLink = `${baseUrl}/monpays/share/${trackingId}`;

        return { success: true, trackingId, shareUrl: trackedLink };
    } catch (error: any) {
        console.error("[initiateTrackedShare] Critical error:", error);
        return { success: false, error: "Impossible de générer le lien de partage." };
    }
}

export async function recordShareClick(trackingId: string, ipAddress: string, userAgent: string): Promise<{ success: boolean; targetPostId?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: shareRows } = await connection.query(
            'SELECT * FROM post_shares WHERE tracking_id = $1 FOR UPDATE',
            [trackingId]
        );

        if (shareRows.length === 0) throw new Error("Lien de partage invalide.");
        const share = shareRows[0];

        await connection.query('SAVEPOINT share_click_sp');
        try {
            // Un même visiteur (IP) ne compte qu'une seule fois par lien : évite l'auto-gain par rechargement.
            const { rows: alreadyCounted } = await connection.query(
                'SELECT 1 FROM share_clicks WHERE share_id = $1 AND ip_address = $2 LIMIT 1',
                [share.id, ipAddress]
            );
            if (alreadyCounted.length > 0) {
                await connection.query('COMMIT');
                return { success: true, targetPostId: share.post_id.toString() };
            }

            await connection.query(
                'INSERT INTO share_clicks (share_id, ip_address, user_agent) VALUES ($1, $2, $3)',
                [share.id, ipAddress, userAgent]
            );
            
            const { rows: updateRows } = await connection.query(
                'UPDATE post_shares SET click_count = click_count + 1 WHERE id = $1 RETURNING click_count, is_paid, user_id, post_id',
                [share.id]
            );
            
            const updatedShare = updateRows[0];

            if (updatedShare.click_count >= 5 && !updatedShare.is_paid) {
                const { rows: postRows } = await connection.query(
                    'SELECT is_monetized, reward_per_share, monetization_budget FROM monpays_posts WHERE id = $1 FOR UPDATE',
                    [updatedShare.post_id]
                );
                
                const post = postRows[0];
                const reward = parseFloat(post.reward_per_share);

                if (post.is_monetized && reward > 0 && Number(post.monetization_budget) >= reward) {
                    await connection.query('UPDATE monpays_posts SET monetization_budget = monetization_budget - $1 WHERE id = $2', [reward, updatedShare.post_id]);
                    
                    const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [updatedShare.user_id]);
                    const user = formatUser(userRows[0]);

                    const tx = await creditShareReward(user, reward, `Récompense de partage (5 clics atteints) - Post #${updatedShare.post_id}`, { tracking_id: trackingId, platform: share.platform }, connection);

                    if (tx.success) {
                        await connection.query('UPDATE post_shares SET is_paid = true WHERE id = $1', [share.id]);
                    }
                }
            }
        } catch (clickError: any) {
            // Le clic ne doit jamais empêcher la redirection, mais l'erreur ne doit plus être silencieuse
            // et la transaction ne doit pas rester dans un état avorté.
            console.error('[recordShareClick]', clickError);
            await connection.query('ROLLBACK TO SAVEPOINT share_click_sp');
        }

        await connection.query('COMMIT');
        return { success: true, targetPostId: share.post_id.toString() };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false };
    } finally {
        connection.release();
    }
}

export async function likeActivity(postId: string, userId: number): Promise<{ success: boolean; likes?: number; isLiked?: boolean }> {
    const id = parseInt(postId, 10);
    try {
        const sid = await sessionUserIdOrNull(userId);
        if (sid === null) return { success: false };
        userId = sid;
        const { rows: existing } = await db.query('SELECT * FROM post_likes WHERE post_id = $1 AND user_id = $2', [id, userId]);
        
        if (existing.length > 0) {
            await db.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [id, userId]);
        } else {
            await db.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [id, userId]);
        }

        const { rows } = await db.query('SELECT COUNT(*) as count FROM post_likes WHERE post_id = $1', [id]);
        return { success: true, likes: Number(rows[0].count), isLiked: existing.length === 0 };
    } catch (error) {
        return { success: false };
    }
}

export async function createMonPaysCompany(args: { user: User; pin: string; companyData: any; }): Promise<{ success: boolean; error?: string; company?: MonPaysCompany; fee?: number; currency?: string }> {
    const { pin, companyData } = args;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }

    // Le débiteur est toujours l'utilisateur de la session (jamais l'objet envoyé par le navigateur).
    const { getAuthenticatedUser } = await import('./user.actions');
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser || (args.user?.id && Number(args.user.id) !== Number(sessionUser.id))) {
        return { success: false, error: 'Session invalide. Veuillez vous reconnecter.' };
    }
    const user = sessionUser;

    if (!companyData?.name || !String(companyData.name).trim()) {
        return { success: false, error: "Le nom de l'entreprise est requis." };
    }

    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        /*
         * MONPAYS_PAGE est configuré avec un frais de référence en USD.
         * La devise de paiement est ensuite obtenue avec le taux FX
         * correspondant au pays de l'utilisateur.
         */
        const referenceFeeUSD = await calculateTransactionFee(
            0,
            'USD',
            'MONPAYS_PAGE',
            user.country,
            connection
        );

        if (referenceFeeUSD <= 0) {
            throw new Error("Le frais de création MonPays n'est pas configuré.");
        }

        const paymentCurrency = companyData.paymentCurrency || 'USD';
        let creationFee = referenceFeeUSD;

        if (paymentCurrency !== 'USD') {
            const countryCode = countryToCode(user.country);

            if (!countryCode) {
                throw new Error("Le pays de l'utilisateur n'est pas correctement configuré.");
            }

            const { rows: rateRows } = await connection.query(
                `SELECT rate
                 FROM exchange_rates
                 WHERE country_code = $1
                   AND from_currency = 'USD'
                   AND to_currency = $2
                 LIMIT 1`,
                [countryCode, paymentCurrency]
            );

            if (rateRows.length === 0) {
                throw new Error(
                    `Le taux USD → ${paymentCurrency} n'est pas disponible pour le pays ${countryCode}.`
                );
            }

            const rate = Number(rateRows[0].rate);

            if (!Number.isFinite(rate) || rate <= 0) {
                throw new Error(
                    `Le taux USD → ${paymentCurrency} configuré pour ${countryCode} est invalide.`
                );
            }

            creationFee = referenceFeeUSD * rate;
        }

        const transactionResult = await createTransaction({
            user,
            typeCode: 'MONPAYS_PAGE',
            amount: creationFee,
            currency: paymentCurrency,
            description: `Frais de création de page MonPays pour ${companyData.name}`,
            metadata: {
                companyName: companyData.name,
                referenceFeeUSD,
                paymentCurrency,
            },
            connection,
        });

        if (!transactionResult.success) {
            throw new Error(transactionResult.error || "Le paiement des frais a échoué.");
        }

        const logoUrl = await saveBase64Image(
            companyData.logoUrl,
            'monpays/logos',
            companyData.name
        );

        const bannerUrl = await saveBase64Image(
            companyData.bannerUrl,
            'monpays/banners',
            companyData.name
        );

        const payload = {
            owner_user_id: user.id,
            company_name: companyData.name,
            category: companyData.category,
            country: companyData.country,
            website_url: companyData.website,
            address: companyData.address,
            rccm: companyData.rccm,
            nif: companyData.nif,
            phone: companyData.phone,
            email: companyData.email,
            logo_url: logoUrl,
            cover_photo_url: bannerUrl,
            status: 'pending',
            owner_wallet_id: user.id_wallet,
        };

        const { rows } = await connection.query(
            `INSERT INTO monpays_companies (
                owner_user_id,
                company_name,
                category,
                country,
                website_url,
                address,
                rccm,
                nif,
                phone,
                email,
                logo_url,
                cover_photo_url,
                status,
                owner_wallet_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *`,
            Object.values(payload)
        );

        await connection.query('COMMIT');

        return {
            success: true,
            company: rows[0],
            fee: Number(creationFee),
            currency: paymentCurrency,
        };
    } catch (error: any) {
        await connection.query('ROLLBACK');

        console.error('[createMonPaysCompany]', error);

        // Les erreurs métier (solde insuffisant, frais/taux non configurés…) doivent être
        // montrées telles quelles ; seules les erreurs SQL/techniques sont masquées.
        const isTechnical =
            (typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code)) ||
            ['ECONNREFUSED', 'ETIMEDOUT'].includes(error?.code);

        return {
            success: false,
            error: isTechnical
                ? (await handleDbError(error, 'creating MonPays company')).error
                : (error?.message || 'La création de la page a échoué.'),
        };
    } finally {
        connection.release();
    }
}

export async function boostActivity(postId: string, userId: number, amount: number, pin: string): Promise<{ success: boolean; error?: string }> {
    const sid = await sessionUserIdOrNull(userId);
    if (sid === null) return { success: false, error: 'Session invalide. Veuillez vous reconnecter.' };
    userId = sid;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return { success: false, error: 'Montant invalide.' };

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const pinVerification = await verifyCurrentUserPin(pin);
        if (!pinVerification.success) throw new Error(pinVerification.error);

        const { rows: postRows } = await connection.query(`
            SELECT p.*, c.owner_user_id 
            FROM monpays_posts p
            JOIN monpays_companies c ON p.author_company_id = c.id
            WHERE p.id = $1 FOR UPDATE
        `, [postId]);

        if (postRows.length === 0) throw new Error("Publication introuvable.");
        if (Number(postRows[0].owner_user_id) !== Number(userId)) throw new Error("Seul le propriétaire de la page peut booster ce post.");

        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = formatUser(userRows[0]);

        const tx = await createTransaction({
            user,
            typeCode: 'AD_FEE',
            amount,
            currency: 'CDF',
            description: `Boost publicitaire MonPays - Publication #${postId}`,
            metadata: { post_id: postId },
            connection
        });

        if (!tx.success) throw new Error("Paiement du boost échoué.");

        const rewardPerShare = amount * 0.1;
        await connection.query(`
            UPDATE monpays_posts 
            SET is_monetized = true, 
                monetization_budget = monetization_budget + $1,
                reward_per_share = $2
            WHERE id = $3
        `, [amount, rewardPerShare, postId]);

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function createMonPaysActivity(
    companyId: number,
    userId: number,
    content: string,
    imageDataUrl?: string | null
): Promise<{ success: boolean; error?: string; }> {
    const sid = await sessionUserIdOrNull(userId);
    if (sid === null) return { success: false, error: 'Session invalide. Veuillez vous reconnecter.' };
    userId = sid;
    if (!(content || '').trim() && !imageDataUrl) return { success: false, error: 'Écrivez un texte ou ajoutez une image.' };

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: companyRows } = await connection.query(
            'SELECT id FROM monpays_companies WHERE id = $1 AND owner_user_id = $2',
            [companyId, userId]
        );

        if (companyRows.length === 0) {
            throw new Error("Action non autorisée. Vous n'êtes pas propriétaire de cette page.");
        }

        let imageUrl: string | null = null;
        if (imageDataUrl) {
            imageUrl = await saveBase64Image(imageDataUrl, 'monpays/posts', `post_${companyId}_${Date.now()}`);
        }

        const postPayload = {
            author_company_id: companyId,
            content: content,
            media_url: imageUrl,
            media_type: imageUrl ? 'image' : null,
        };

        await connection.query(
            'INSERT INTO monpays_posts (author_company_id, content, media_url, media_type, status) VALUES ($1, $2, $3, $4, $5)',
            [postPayload.author_company_id, postPayload.content, postPayload.media_url, postPayload.media_type, 'published']
        );

        await connection.query('COMMIT');
        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function getCompaniesForUser(userId: number): Promise<MonPaysCompany[]> {
    try {
        const { rows } = await db.query(
            `SELECT * FROM monpays_companies WHERE owner_user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return rows.map(row => ({
            id: row.id.toString(),
            name: row.company_name,
            description: row.description,
            logoUrl: row.logo_url,
            bannerUrl: row.cover_photo_url,
            isVerified: row.status === 'verified',
            ownerWalletId: row.owner_wallet_id,
            ownerUserId: row.owner_user_id != null ? Number(row.owner_user_id) : undefined,
            category: row.category,
            countryCode: row.country,
            website: row.website_url,
            address: row.address,
            phone: row.phone,
            email: row.email,
        })) as MonPaysCompany[];
    } catch(error) {
        return [];
    }
}

export async function shareActivity(postId: string, userId: number): Promise<{ success: boolean; message: string; reward?: number }> {
    const id = parseInt(postId, 10);
    const sid = await sessionUserIdOrNull(userId);
    if (sid === null) return { success: false, message: 'Veuillez vous reconnecter.' };
    userId = sid;
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: postRows } = await connection.query(
            'SELECT is_monetized, reward_per_share, monetization_budget FROM monpays_posts WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (postRows.length === 0) throw new Error("Publication introuvable.");
        const post = postRows[0];

        const { rows: existingShare } = await connection.query(
            'SELECT id FROM post_shares WHERE post_id = $1 AND user_id = $2',
            [id, userId]
        );

        if (existingShare.length > 0) {
            await connection.query('ROLLBACK');
            return { success: true, message: "Lien de partage récupéré (déjà partagé auparavant)." };
        }

        let reward = 0;
        if (post.is_monetized && parseFloat(post.monetization_budget) >= parseFloat(post.reward_per_share)) {
            reward = parseFloat(post.reward_per_share);
            
            const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [userId]);
            const user = formatUser(userRows[0]);

            const tx = await creditShareReward(user, reward, `Récompense de partage MonPays - Post #${id}`, { post_id: id }, connection);

            if (!tx.success) throw new Error("Échec du crédit de la récompense.");

            await connection.query(
                'UPDATE monpays_posts SET monetization_budget = monetization_budget - $1 WHERE id = $2',
                [reward, id]
            );
        }

        await connection.query(
            'INSERT INTO post_shares (post_id, user_id, amount_earned) VALUES ($1, $2, $3)',
            [id, userId, reward]
        );

        await connection.query('COMMIT');
        return { 
            success: true, 
            message: reward > 0 
                ? `Partage réussi ! ${reward} CDF ont été ajoutés à votre compte.` 
                : "Publication partagée avec succès.",
            reward
        };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, message: error.message || "Une erreur est survenue lors du partage." };
    } finally {
        connection.release();
    }
}


/**
 * Frais de création d'une page entreprise, dans la devise de paiement choisie (même calcul que la création :
 * frais de référence USD « MONPAYS_PAGE » × taux USD→devise du pays de l'utilisateur).
 */
export async function getMonPaysCreationFee(paymentCurrency: string = 'USD'): Promise<{ success: boolean; fee?: number; currency?: string; referenceFeeUSD?: number; error?: string }> {
    const { getAuthenticatedUser } = await import('./user.actions');
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: 'Session expirée.' };

    const connection = await db.getConnection();
    try {
        const referenceFeeUSD = await calculateTransactionFee(0, 'USD', 'MONPAYS_PAGE', user.country, connection);
        if (!(referenceFeeUSD > 0)) return { success: false, error: "Le frais de création MonPays n'est pas configuré." };

        const currency = String(paymentCurrency || 'USD').toUpperCase();
        let fee = referenceFeeUSD;
        if (currency !== 'USD') {
            const countryCode = countryToCode(user.country);
            if (!countryCode) return { success: false, error: "Le pays de l'utilisateur n'est pas correctement configuré." };
            const { rows } = await connection.query(
                `SELECT rate FROM exchange_rates WHERE country_code = $1 AND from_currency = 'USD' AND to_currency = $2 LIMIT 1`,
                [countryCode, currency]
            );
            const rate = Number(rows[0]?.rate);
            if (!Number.isFinite(rate) || rate <= 0) return { success: false, error: `Taux USD → ${currency} indisponible pour ${countryCode}.` };
            fee = referenceFeeUSD * rate;
        }
        return { success: true, fee, currency, referenceFeeUSD };
    } catch (e: any) {
        console.error('[getMonPaysCreationFee]', e);
        return { success: false, error: 'Impossible de calculer les frais.' };
    } finally {
        connection.release();
    }
}
