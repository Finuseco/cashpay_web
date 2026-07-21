

'use server';

import type { Notification } from '@/lib/types';
import { db } from '../db';
import { handleDbError } from './helpers';

export async function getNotifications(userId: number, limit: number = 20): Promise<Notification[]> {
    try {
        const { rows } = await db.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
        return rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            timestamp: new Date(row.created_at).toISOString(),
            read: Boolean(row.is_read),
            type: row.type,
            link: row.link,
        }));
    } catch (error) {
        handleDbError(error, 'fetching notifications');
        return [];
    }
}

export async function createNotification(
    userId: number, 
    title: string, 
    description: string,
    type: 'new_message' | 'missed_audio_call' | 'missed_video_call' | 'meeting_invite' | 'general' | 'game_invite' | 'pos_sale' | 'new_follower' = 'general',
    metadata?: Record<string, any>
): Promise<void> {
    try {
        let link: string | null = null;
        if (type === 'new_message' && metadata?.contactId) {
            link = `/feedback?contactId=${metadata.contactId}`;
        } else if (type === 'missed_audio_call' && metadata?.contactId) {
            link = `/feedback?contactId=${metadata.contactId}&call=true`;
        } else if (type === 'missed_video_call' && metadata?.contactId) {
            link = `/feedback?contactId=${metadata.contactId}&call=true`;
        } else if (type === 'pos_sale') {
            link = `/agent/history`;
        } else if (type === 'new_follower' && metadata?.followerId) {
            link = `/agent/sellers/${metadata.followerId}`;
        }


        const notificationData = {
            user_id: userId,
            title,
            description,
            type,
            link,
            is_read: false,
        };
        await db.query('INSERT INTO notifications (user_id, title, description, type, link, is_read) VALUES ($1, $2, $3, $4, $5, $6)', Object.values(notificationData));
    } catch (error) {
        handleDbError(error, 'creating notification');
    }
}

export async function markNotificationAsRead(notificationId: number, userId: number): Promise<void> {
    try {
        await db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [notificationId, userId]);
    } catch (error) {
        handleDbError(error, 'marking notification as read');
    }
}

export async function markAllNotificationsAsRead(userId: number): Promise<void> {
    try {
        await db.query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [userId]);
    } catch (error) {
        handleDbError(error, 'marking all notifications as read');
    }
}
