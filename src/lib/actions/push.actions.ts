

'use server';

import webpush from 'web-push';
import { db } from '@/lib/db';
import { handleDbError } from '@/lib/actions/helpers';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.warn("VAPID keys not configured. Push notifications will be disabled.");
}

export async function sendPushNotification(userId: number, title: string, body: string, url?: string) {
    if (!process.env.VAPID_PUBLIC_KEY) {
        console.log(`Push notification for user ${userId} not sent because VAPID keys are not configured.`);
        return;
    }
    try {
        const { rows: subscriptions } = await db.query('SELECT subscription_data FROM push_subscriptions WHERE user_id = $1', [userId]);

        const notificationPayload = JSON.stringify({
            title,
            body,
            icon: '/logos/favicon.png',
            data: { url }
        });

        const sendPromises = subscriptions.map(async (sub: any) => {
            // Check if subscription_data is a string, and if so, parse it
            const subscription = typeof sub.subscription_data === 'string'
                ? JSON.parse(sub.subscription_data)
                : sub.subscription_data;
                
            try {
                await webpush.sendNotification(subscription, notificationPayload);
            } catch (error: any) {
                 if (error.statusCode === 410 || error.statusCode === 404) {
                    console.log(`Subscription for user ${userId} has expired or is invalid. Deleting.`);
                    await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [subscription.endpoint]);
                } else {
                    console.error('Failed to send push notification:', error);
                }
            }
        });

        await Promise.all(sendPromises);

    } catch (error: any) {
        handleDbError(error, 'sending push notification');
    }
}
