
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { getAuthenticatedUser } from './user.actions';
import { sendEmail } from '@/services/email';
import type { PublisherDetails, AdPlacement, PublisherSite } from '@/lib/types';
import type { PoolClient } from 'pg';

// --- List of competitor ad network patterns ---
const COMPETITOR_PATTERNS: Record<string, RegExp> = {
    "Google AdSense": /adsbygoogle\\.js|googlesyndication\\.com/,
    "Facebook Ads": /connect\\.facebook\\.net|fbevents\\.js/,
    "Taboola": /taboola\\.com/,
    "Outbrain": /outbrain\\.com/
};


export async function getPublisherDetails(userId: number): Promise<PublisherDetails | null> {
    try {
        const { rows: publisherRows } = await db.query('SELECT publisher_id FROM ad_publishers WHERE user_id = $1', [userId]);

        if (publisherRows.length === 0) {
            return null; // User is not a publisher yet
        }

        const publisherId = publisherRows[0].publisher_id;
        
        const { rows: siteRows } = await db.query('SELECT * FROM publisher_sites WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        const { rows: placementRows } = await db.query('SELECT * FROM ad_placements WHERE blogger_user_id = $1', [userId]);
        
        const sites: PublisherSite[] = siteRows.map(row => ({
            id: row.id,
            name: row.name,
            url: row.url,
            status: row.status,
            verification_code: row.verification_code,
        }));
        
        const placements: AdPlacement[] = placementRows.map(row => ({
            id: row.id,
            blogger_user_id: row.blogger_user_id,
            placement_code: `PL_${row.id}`, // Generate a simple placement code
            name: row.name,
            format: row.format,
            is_active: row.is_active,
            site_id: row.site_id,
        }));

        return {
            publisherId,
            sites,
            placements,
        };

    } catch (error) {
        await handleDbError(error, 'fetching publisher details');
        return null;
    }
}

export async function registerPublisherSite(data: { siteName: string; siteUrl: string }): Promise<{ success: boolean; error?: string; verificationCode?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: 'Utilisateur non authentifié.' };
    }
    
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        let { rows: publisherRows } = await connection.query('SELECT id FROM ad_publishers WHERE user_id = $1', [user.id]);
        if (publisherRows.length === 0) {
            const publisherId = `pub_${user.id}_${Date.now().toString(36)}`;
            await connection.query('INSERT INTO ad_publishers (user_id, publisher_id, status) VALUES ($1, $2, $3)', [user.id, publisherId, 'active']);
        }
        
        const verificationCode = `cashpay-verify-${Math.random().toString(36).substring(2, 12)}`;

        const sitePayload = {
            user_id: user.id,
            name: data.siteName,
            url: data.siteUrl,
            status: 'pending',
            verification_code: verificationCode,
        };
        await connection.query('INSERT INTO publisher_sites (user_id, name, url, status, verification_code) VALUES ($1, $2, $3, $4, $5)', [sitePayload.user_id, sitePayload.name, sitePayload.url, sitePayload.status, sitePayload.verification_code]);

        await connection.query('COMMIT');
        
        if (user.email) {
            await sendEmail(user.email, 'Vérifiez la propriété de votre site', 'verify_site', {
                userName: user.first_name || user.full_name,
                siteUrl: data.siteUrl,
                verificationTag: `<meta name="cashpay-verification" content="${verificationCode}">`,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/marketing/ads`,
            });
        }
        
        return { success: true, verificationCode };

    } catch (error) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'registering publisher site');
        return { success: false, error: dbError.error };
    } finally {
        connection.release();
    }
}


export async function createAdPlacement(data: { name: string; format: 'banner' | 'popup' | 'video' }): Promise<{ success: boolean; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Utilisateur non authentifié." };
    }
    
    try {
        const { rows: siteRows } = await db.query('SELECT id FROM publisher_sites WHERE user_id = $1 AND status = $2 LIMIT 1', [user.id, 'approved']);

        if (siteRows.length === 0) {
            return { success: false, error: "Aucun site approuvé trouvé. Veuillez d'abord faire vérifier un site." };
        }
        const siteId = siteRows[0].id;
        
        const payload = {
            blogger_user_id: user.id,
            site_id: siteId,
            name: data.name,
            format: data.format,
            is_active: true,
        };
        await db.query('INSERT INTO ad_placements (blogger_user_id, site_id, name, format, is_active) VALUES ($1, $2, $3, $4, $5)', [payload.blogger_user_id, payload.site_id, payload.name, payload.format, payload.is_active]);
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'creating ad placement');
        return { success: false, error: dbError.error };
    }
}

export async function verifySiteOwnership(siteId: number): Promise<{ success: boolean; error?: string; competitors?: string[] }> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, error: 'Non authentifié.' };
  }

  try {
    const { rows: siteRows } = await db.query(
      'SELECT url, verification_code FROM publisher_sites WHERE id = $1 AND user_id = $2',
      [siteId, user.id]
    );

    if (siteRows.length === 0) {
      return { success: false, error: 'Site non trouvé ou non autorisé.' };
    }

    const site = siteRows[0];
    const response = await fetch(site.url, { cache: 'no-store' });
    if (!response.ok) {
      return { success: false, error: `Impossible de récupérer le contenu de ${site.url}. Statut: ${response.status}` };
    }

    const html = await response.text();
    const expectedTag = `<meta name="cashpay-verification" content="${site.verification_code}">`;

    if (!html.includes(expectedTag)) {
        if (user.email) {
             await sendEmail(user.email, 'Échec de la vérification de votre site', 'site_verification_failed', {
                userName: user.first_name || user.full_name,
                siteUrl: site.url,
                verificationTag: expectedTag,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/marketing/ads`,
            });
        }
        return { success: false, error: 'La balise de vérification est introuvable. Assurez-vous qu\'elle est bien placée dans la section <head> de votre site. Un email vous a été envoyé avec les détails.' };
    }
    
    const foundCompetitors = Object.entries(COMPETITOR_PATTERNS)
      .filter(([_, pattern]) => pattern.test(html))
      .map(([name]) => name);

    if (foundCompetitors.length > 0) {
      const competitorsList = foundCompetitors.join(', ');
      console.log(`[Publisher Action] Competitors found for site ${site.url}:`, competitorsList);
      if (user.email) {
        await sendEmail(user.email, 'Action requise pour la vérification de votre site', 'site_rejected_competitors', {
            userName: user.first_name || user.full_name,
            siteUrl: site.url,
            competitorsList: competitorsList,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/marketing/ads`,
        });
         console.log(`[Publisher Action] Rejection email sent to ${user.email}.`);
      }
      return {
        success: false,
        error: `Nous avons détecté la présence d'autres régies publicitaires. Veuillez les retirer pour continuer.`,
        competitors: foundCompetitors,
      };
    }

    await db.query('UPDATE publisher_sites SET status = $1 WHERE id = $2', ['approved', siteId]);
    
    if (user.email) {
      await sendEmail(user.email, 'Votre site a été approuvé !', 'site_approved', {
        userName: user.first_name || user.full_name,
        siteUrl: site.url,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/marketing/ads`,
      });
      console.log(`[Publisher Action] Approval email sent to ${user.email}.`);
    }

    return { success: true };

  } catch (error: any) {
    console.error('Error verifying site ownership:', error);
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      return { success: false, error: "Impossible de résoudre l'URL du site. Veuillez vérifier l'adresse." };
    }
    return { success: false, error: 'Une erreur inattendue est survenue lors de la vérification.' };
  }
}

export async function deletePublisherSite(siteId: number): Promise<{ success: boolean; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Non authentifié." };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: siteRows } = await connection.query('SELECT id, name FROM publisher_sites WHERE id = $1 AND user_id = $2', [siteId, user.id]);
        if (siteRows.length === 0) {
            throw new Error("Site non trouvé ou vous n'avez pas la permission de le supprimer.");
        }
        const siteName = siteRows[0].name;

        const { rows: placementRows } = await connection.query('SELECT id FROM ad_placements WHERE site_id = $1', [siteId]);
        
        if (placementRows.length > 0) {
            const placementIds = placementRows.map(p => p.id);
            await connection.query('DELETE FROM ad_logs WHERE placement_id = ANY($1::int[])', [placementIds]);
            await connection.query('DELETE FROM ad_placements WHERE id = ANY($1::int[])', [placementIds]);
        }

        await connection.query('DELETE FROM publisher_sites WHERE id = $1', [siteId]);

        await connection.query('COMMIT');

        if (user.email) {
            await sendEmail(user.email, `Confirmation de suppression du site ${siteName}`, 'general', {
                title: 'Site Supprimé',
                greeting: `Bonjour ${user.first_name},`,
                message: `Nous vous confirmons que votre site "${siteName}" et tous ses emplacements publicitaires associés ont bien été supprimés de la plateforme CashPay.`,
                buttonText: 'Accéder au portail éditeur',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/marketing/ads`,
                signature: "L'équipe CashPay"
            });
        }
        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'deleting publisher site');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}
