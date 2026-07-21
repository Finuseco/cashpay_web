
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to handle a bill payment (e.g., electricity, water).
 * This is a mock endpoint.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { billerCode, accountNumber, amount, currency, pin } = await request.json();

  if (!billerCode || !accountNumber || !amount || !currency || !pin) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }

  // Mock logic:
  // 1. Verify user's PIN.
  if (pin !== '1234') {
       return NextResponse.json({ success: false, error: 'Invalid PIN.' }, { status: 401 });
  }
  
  // 2. Check user's balance.
  // 3. Call the biller's API to confirm the payment.
  // 4. Debit user and log the transaction.
  console.log(`[API MOCK] Processing bill payment of ${amount} ${currency} for ${billerCode} account ${accountNumber}.`);

  return NextResponse.json({ 
    success: true, 
    message: `Payment for ${billerCode} successful`
  });
}
