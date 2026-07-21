
'use server';

import { db } from '@/lib/db';

export async function checkForInAppOtpAction(userId: number): Promise<{ otp: string; type: string } | null> {
    try {
        const { rows } = await db.query(
            `SELECT code, type FROM otps WHERE user_id = $1 AND channel = 'in-app' AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (rows.length > 0) {
            await db.query(`UPDATE otps SET used = true WHERE user_id = $1 AND code = $2 AND channel = 'in-app'`, [userId, rows[0].code]);
            return { otp: rows[0].code, type: rows[0].type };
        }
        return null;
    } catch (error) {
        console.error("Error checking for in-app OTP:", error);
        return null;
    }
}
