import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to handle sending money between users.
 * This should be an authenticated route.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { recipientWalletId, amount, currency, pin } = await request.json();

  if (!recipientWalletId || !amount || !currency || !pin) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }

  // Mock logic:
  // 1. Verify sender's PIN (assume PIN '1234' is correct)
  if (pin !== '1234') {
      return NextResponse.json({ success: false, error: 'Invalid PIN.' }, { status: 401 });
  }

  // 2. Check sender's balance (assume sufficient balance)
  // 3. Debit sender, credit recipient
  // 4. Log the transaction
  console.log(`[API MOCK] Transferring ${amount} ${currency} to ${recipientWalletId}`);

  return NextResponse.json({ 
    success: true, 
    message: `Transfer of ${amount} ${currency} to ${recipientWalletId} successful.`,
    transactionId: `mock_txn_${Date.now()}`
  });
}
