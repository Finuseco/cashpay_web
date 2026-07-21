
'use server';

// This is a mock function. In a real application, this would use the WhatsApp Business API via a provider like Twilio.
const WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0/YOUR_PHONE_NUMBER_ID/messages';
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;

export async function sendWhatsAppTextMessage(to: string, message: string): Promise<{ success: boolean, message?: string }> {
    console.log(`--- Sending WhatsApp Message ---`);
    console.log(`To: ${to}`);
    console.log(`Message: ${message}`);
    console.log(`------------------------------`);

    if (!WHATSAPP_API_TOKEN || WHATSAPP_API_TOKEN === 'YOUR_WHATSAPP_API_TOKEN') {
        console.warn('WhatsApp API token not configured. Skipping actual send.');
        return { success: true, message: 'Message logged, not sent.' };
    }
    
    try {
        const response = await fetch(WHATSAPP_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: to,
                type: "text",
                text: { body: message }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`WhatsApp API Error: ${JSON.stringify(errorData)}`);
        }
        
        return { success: true };
    } catch (error: any) {
        console.error("Failed to send WhatsApp message:", error.message);
        return { success: false, message: error.message };
    }
}
