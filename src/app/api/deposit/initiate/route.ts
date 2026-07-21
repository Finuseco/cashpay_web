
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to initiate a deposit from an external source (e.g., Mobile Money).
 * This is a mock endpoint.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { method, amount, currency, source_identifier } = await request.json(); // source_identifier could be a phone number for MM

  if (!method || !amount || !currency || !source_identifier) {
    return NextResponse.json({ success: false, error: 'Missing required fields (method, amount, currency, source_identifier).' }, { status: 400 });
  }
  
  console.log(`[API MOCK] Initiating a ${amount} ${currency} deposit via ${method} from ${source_identifier}.`);

  // Mock logic:
  // 1. Create a PENDING transaction in your database.
  // 2. Call the third-party API (e.g., M-Pesa, Orange Money) to request the payment from the user.
  // 3. The third-party service will then call your webhook to confirm the payment.

  return NextResponse.json({ 
    success: true, 
    message: `A payment request has been sent to ${source_identifier}. Please confirm on your phone to complete the deposit.`,
    transaction_reference: `mock_txn_${Date.now()}`
  });
}
