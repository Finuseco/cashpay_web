
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';

// This is a mock function. In a real application, this would use a service like Twilio or Vonage.
export async function sendSms(phoneNumber: string, message: string): Promise<{ success: boolean; message?: string }> {
    console.log(`--- Sending SMS ---`);
    console.log(`To: ${phoneNumber}`);
    console.log(`Message: ${message}`);
    console.log(`-------------------`);

    try {
        await db.query(
            'INSERT INTO sms_log (phone_number, message, status) VALUES ($1, $2, $3)',
            [phoneNumber, message, 'sent']
        );
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'logging SMS');
        // We still return success to the caller because the SMS *would* have sent,
        // but we log the DB error.
        console.error("Failed to log SMS to database:", dbError.error);
        return { success: true, message: "Logged with failure." };
    }
}
