
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to handle a loan repayment.
 * This is a mock endpoint.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { loanId, amount, pin } = await request.json();

  if (!loanId || !amount || !pin) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }

  // Mock logic:
  // 1. Verify user's PIN.
  if (pin !== '1234') {
       return NextResponse.json({ success: false, error: 'Invalid PIN.' }, { status: 401 });
  }
  
  // 2. Check user's balance.
  // 3. Debit user's wallet.
  // 4. Update the loan's remaining balance in the database.
  console.log(`[API MOCK] Processing repayment of ${amount} for loan ${loanId}.`);

  return NextResponse.json({ 
    success: true, 
    message: `Repayment of ${amount} for loan ${loanId} was successful.`,
    transactionId: `mock_repay_txn_${Date.now()}`
  });
}
