
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to handle a currency exchange between a user's wallets.
 * This is a mock endpoint.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { fromCurrency, toCurrency, amount, pin } = await request.json();

  if (!fromCurrency || !toCurrency || !amount || !pin) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }
  
  // Mock logic:
  // 1. Verify user's PIN.
  if (pin !== '1234') {
       return NextResponse.json({ success: false, error: 'Invalid PIN.' }, { status: 401 });
  }
  
  // 2. Check balance in 'fromCurrency' wallet.
  // 3. Perform the exchange calculation.
  // 4. Debit 'from' wallet and credit 'to' wallet.
  // 5. Log the transaction.
  console.log(`[API MOCK] Processing exchange of ${amount} ${fromCurrency} to ${toCurrency}.`);

  return NextResponse.json({ 
    success: true, 
    message: `Exchange successful.`,
    transactionId: `mock_txn_${Date.now()}`
  });
}
