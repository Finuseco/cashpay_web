
import { type NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

/**
 * Handles GET requests for WhatsApp webhook verification.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified successfully!');
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error('Failed webhook verification. Make sure the VERIFY_TOKEN is set correctly.');
    return new NextResponse(null, { status: 403 });
  }
}

/**
 * Handles POST requests with WhatsApp message notifications.
 * This is where you would process incoming messages from users.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log('Received WhatsApp webhook:', JSON.stringify(body, null, 2));

  // Example of processing a text message
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (message?.type === 'text') {
    const userPhoneNumber = message.from;
    const userMessage = message.text.body;

    console.log(`Received message "${userMessage}" from ${userPhoneNumber}`);
    
    // TODO: Add logic here to:
    // 1. Find the user in your database by their phone number.
    // 2. Pass the message to your AI chatbot for a response.
    // 3. Use the sendWhatsAppTextMessage function to send the AI's response back to the user.
  }

  // WhatsApp requires a 200 OK response to acknowledge receipt of the webhook.
  return new NextResponse(null, { status: 200 });
}
