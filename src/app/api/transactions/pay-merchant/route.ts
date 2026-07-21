
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to handle a merchant payment via QR code scan.
 * This should be an authenticated route.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { merchantId, amount, currency, pin } = await request.json();

  if (!merchantId || !amount || !currency || !pin) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }

  // Mock logic:
  // 1. Verify user's PIN.
  if (pin !== '1234') {
       return NextResponse.json({ success: false, error: 'Invalid PIN.' }, { status: 401 });
  }
  
  // 2. Check user's balance.
  // 3. Debit user, credit merchant.
  // 4. Log the transaction.
  console.log(`[API MOCK] Processing payment of ${amount} ${currency} to merchant ${merchantId}.`);

  return NextResponse.json({ 
    success: true, 
    message: `Payment to merchant ${merchantId} successful.`,
    transactionId: `mock_txn_${Date.now()}`
  });
}
