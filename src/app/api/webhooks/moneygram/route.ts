import { type NextRequest, NextResponse } from 'next/server';

/**
 * Handles POST requests with MoneyGram transaction status updates.
 * In a real application, you would verify the webhook signature and then
 * update the transaction status in your database based on the event type.
 * 
 * https://developer.moneygram.com/moneygram-developer/docs/webhooks-introduction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('--- Received MoneyGram Webhook ---');
    console.log(JSON.stringify(body, null, 2));
    
    // Example: Check for a specific event
    const eventType = body.event?.eventType;
    if (eventType === 'transaction.completed') {
        const transactionId = body.data?.transactionId;
        console.log(`Transaction ${transactionId} has been completed and funds delivered.`);
        // TODO: Update your database record for this transaction to 'Completed'.
    }

    // MoneyGram requires a 200 OK response to acknowledge receipt.
    return new NextResponse(null, { status: 200 });

  } catch (error) {
    console.error('Error processing MoneyGram webhook:', error);
    // Return a server error response
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
