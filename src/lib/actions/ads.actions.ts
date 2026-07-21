
'use server';

import type { User, Product } from '@/lib/types';
import { db } from '../db';
import { handleDbError, saveBase64Image } from './helpers';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';

export interface AdCampaign {
    id: number;
    userId: number;
    name: string;
    targetUrl: string;
    imageUrl: string;
    format: 'banner' | 'popup' | 'video';
    budget: number;
    durationDays: number;
    status: 'pending_approval' | 'approved' | 'rejected' | 'active' | 'completed' | 'paused';
    createdAt: string;
}

interface CreateAdCampaignArgs {
    user: User;
    name: string;
    targetUrl: string;
    imageUrl: string;
    format: 'banner' | 'popup' | 'video';
    budget: number;
    durationDays: number;
}


export async function createAdCampaign(args: CreateAdCampaignArgs): Promise<{ success: boolean; error?: string }> {
    const { user, ...campaignData } = args;
    
    try {
        let finalImageUrl = campaignData.imageUrl;
        if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
            const savedImagePath = await saveBase64Image(finalImageUrl, 'ads', `campaign_${user.id}_${Date.now()}`);
            if (!savedImagePath) {
                return { success: false, error: "Impossible d'enregistrer l'image de la campagne." };
            }
            finalImageUrl = savedImagePath;
        }

        const newCampaign = {
            user_id: user.id,
            name: campaignData.name,
            target_url: campaignData.targetUrl,
            image_url: finalImageUrl,
            format: campaignData.format,
            budget: campaignData.budget,
            duration_days: campaignData.durationDays,
            status: 'pending_approval'
        };

        await db.query('INSERT INTO ad_campaigns (user_id, name, target_url, image_url, format, budget, duration_days, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
            [newCampaign.user_id, newCampaign.name, newCampaign.target_url, newCampaign.image_url, newCampaign.format, newCampaign.budget, newCampaign.duration_days, newCampaign.status]);
        
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'creating ad campaign');
        return { success: false, error: dbError.error };
    }
}

export async function getAdCampaignsForUser(userId: number): Promise<AdCampaign[]> {
    try {
        const { rows } = await db.query(
            'SELECT * FROM ad_campaigns WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return rows.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            name: row.name,
            targetUrl: row.target_url,
            imageUrl: row.image_url,
            format: row.format,
            budget: parseFloat(row.budget),
            durationDays: row.duration_days,
            status: row.status,
            createdAt: new Date(row.created_at).toISOString(),
        }));
    } catch (error) {
        await handleDbError(error, 'fetching ad campaigns');
        return [];
    }
}
