
'use server';

/**
 * @fileoverview A service for sending SMS messages using Dream Digital API.
 */

interface SmsResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

/**
 * Sends an SMS message to a given phone number.
 * @param phoneNumber The recipient's phone number.
 * @param message The message to send.
 * @returns A promise that resolves with the SMS response.
 */
export async function sendSms(phoneNumber: string, message: string): Promise<SmsResponse> {
  const apiUrl = process.env.DREAM_DIGITAL_API_URL;
  const apiId = process.env.DREAM_DIGITAL_API_ID;
  const apiPassword = process.env.DREAM_DIGITAL_API_PASSWORD;
  const senderId = process.env.DREAM_DIGITAL_SENDER_ID || 'CashPay';

  if (!apiUrl || !apiId || !apiPassword || apiId.includes('YOUR_API_ID')) {
    const errorMessage = 'Dream Digital SMS API credentials are not configured.';
    console.error(`[SMS Service] ${errorMessage}`);
    return { success: false, message: 'Le service SMS est temporairement indisponible.' };
  }

  const queryParams = new URLSearchParams({
    api_id: apiId,
    api_password: apiPassword,
    sms_type: 'T',
    encoding: 'T',
    sender_id: senderId,
    phonenumber: phoneNumber,
    textmessage: message,
  });

  const fullUrl = `${apiUrl}?${queryParams.toString()}`;

  try {
    console.log(`[SMS Service] Sending SMS to ${phoneNumber} via Dream Digital using GET.`);
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'CashPay/1.0',
      },
    });
    
    const textResponse = await response.text();
    console.log(`[SMS Service] Dream Digital API Response: ${textResponse}`);
    
    // According to many simple SMS gateways, a 200 OK with a specific text response indicates success.
    // We'll assume any 200 OK is a success for this mock.
    if (response.ok) {
      return { success: true, message: 'SMS sent successfully.' };
    } else {
      return { success: false, message: `Failed to send SMS. Provider response: ${textResponse}` };
    }
  } catch (error: any) {
    console.error('[SMS Service] Error calling Dream Digital API:', error);
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.name === 'TimeoutError') {
      return { success: false, message: 'Le service SMS est actuellement indisponible. Veuillez réessayer plus tard.' };
    }
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
