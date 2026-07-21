'use server';

import { db } from '@/lib/db';
import { handleDbError, saveBase64Image } from './helpers';
import type { User, Status, StatusGroup } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';

type CreateStatusArgs = {
  userId: number;
  type: 'text' | 'image' | 'video';
  content: string;
  backgroundColor?: string;
};

export async function createStatus(args: CreateStatusArgs): Promise<{ success: boolean; error?: string }> {
    const { userId, type, content, backgroundColor } = args;

    try {
        let finalContent = content;

        if ((type === 'image' || type === 'video') && content.startsWith('data:')) {
            const mediaUrl = await saveBase64Image(content, 'statuses', `status_${userId}`);
            if (!mediaUrl) {
                return { success: false, error: 'Failed to save media file.' };
            }
            finalContent = mediaUrl;
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const newStatus = {
            user_id: userId,
            type,
            content: finalContent,
            background_color: backgroundColor,
            expires_at: expiresAt
        };

        await db.query('INSERT INTO statuses (user_id, type, content, background_color, expires_at) VALUES ($1, $2, $3, $4, $5)', Object.values(newStatus));

        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'creating status');
        return { success: false, error: dbError.error };
    }
}

export async function getStatusesForUser(userId: number): Promise<StatusGroup[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                s.id, s.user_id, s.type, s.content, s.background_color, s.created_at,
                u.full_name, u.profile_photo
            FROM statuses s
            JOIN users u ON s.user_id = u.id
            WHERE s.expires_at > NOW()
            ORDER BY s.user_id, s.created_at ASC
        `);

        if (rows.length === 0) {
            return [];
        }

        const groupedByContact = rows.reduce((acc, row) => {
            const contactId = row.user_id;
            if (!acc[contactId]) {
                acc[contactId] = {
                    contact: {
                        id: row.user_id,
                        full_name: row.full_name,
                        profile_photo: row.profile_photo,
                    },
                    statuses: [],
                    hasUnseen: true, // Mock value, you'd need a 'views' table for this
                };
            }
            acc[contactId].statuses.push({
                id: row.id,
                userId: row.user_id,
                type: row.type,
                content: row.content,
                backgroundColor: row.background_color,
                createdAt: new Date(row.created_at).toISOString(),
            });
            return acc;
        }, {} as Record<number, StatusGroup>);

        return Object.values(groupedByContact);
    } catch (error) {
        handleDbError(error, 'fetching statuses');
        return [];
    }
}

export async function deleteExpiredStatuses(): Promise<void> {
    try {
        const { rows: expiredStatuses } = await db.query('SELECT id, type, content FROM statuses WHERE expires_at < NOW()');

        if (expiredStatuses.length === 0) {
            console.log('[Status Cleanup] No expired statuses to delete.');
            return;
        }

        const fileDeletionPromises: Promise<any>[] = [];
        const statusIdsToDelete: number[] = [];

        for (const status of expiredStatuses) {
            statusIdsToDelete.push(status.id);
            if ((status.type === 'image' || status.type === 'video') && status.content.startsWith('/images/statuses/')) {
                const filePath = path.join(process.cwd(), 'public', status.content);
                fileDeletionPromises.push(
                    fs.unlink(filePath).catch(err => {
                        console.error(`Failed to delete status file ${filePath}:`, err.message);
                    })
                );
            }
        }

        await Promise.all(fileDeletionPromises);
        
        if (statusIdsToDelete.length > 0) {
            const { rowCount } = await db.query('DELETE FROM statuses WHERE id = ANY($1::int[])', [statusIdsToDelete]);
            console.log(`[Status Cleanup] Deleted ${rowCount} expired statuses from DB and their associated files.`);
        }
    } catch (error) {
        handleDbError(error, 'deleting expired statuses');
    }
}
