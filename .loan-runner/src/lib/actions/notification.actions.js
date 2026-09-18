'use server';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = getNotifications;
exports.createNotification = createNotification;
exports.markNotificationAsRead = markNotificationAsRead;
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
const db_1 = require("../db");
const helpers_1 = require("./helpers");
async function getNotifications(userId, limit = 20) {
    try {
        const { rows } = await db_1.db.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
        return rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            timestamp: new Date(row.created_at).toISOString(),
            read: Boolean(row.is_read),
            type: row.type,
            link: row.link,
        }));
    }
    catch (error) {
        (0, helpers_1.handleDbError)(error, 'fetching notifications');
        return [];
    }
}
async function createNotification(userId, title, description, type = 'general', metadata) {
    try {
        let link = null;
        if (type === 'new_message' && metadata?.contactId) {
            link = `/feedback?contactId=${metadata.contactId}`;
        }
        else if (type === 'missed_audio_call' && metadata?.contactId) {
            link = `/feedback?contactId=${metadata.contactId}&call=true`;
        }
        else if (type === 'missed_video_call' && metadata?.contactId) {
            link = `/feedback?contactId=${metadata.contactId}&call=true`;
        }
        else if (type === 'pos_sale') {
            link = `/agent/history`;
        }
        else if (type === 'new_follower' && metadata?.followerId) {
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
        await db_1.db.query('INSERT INTO notifications (user_id, title, description, type, link, is_read) VALUES ($1, $2, $3, $4, $5, $6)', Object.values(notificationData));
    }
    catch (error) {
        (0, helpers_1.handleDbError)(error, 'creating notification');
    }
}
async function markNotificationAsRead(notificationId, userId) {
    try {
        await db_1.db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [notificationId, userId]);
    }
    catch (error) {
        (0, helpers_1.handleDbError)(error, 'marking notification as read');
    }
}
async function markAllNotificationsAsRead(userId) {
    try {
        await db_1.db.query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [userId]);
    }
    catch (error) {
        (0, helpers_1.handleDbError)(error, 'marking all notifications as read');
    }
}
