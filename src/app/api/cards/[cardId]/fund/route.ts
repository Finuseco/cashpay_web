
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to fund a card from a user's wallet.
 * This is a mock endpoint.
 */
export async function POST(request: NextRequest, { params }: { params: { cardId: string } }) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  
  const cardId = params.cardId;
  const { amount, walletCurrency, pin } = await request.json();

  if (!amount || !walletCurrency || !pin) {
    return NextResponse.json({ success: false, error: 'Missing required fields (amount, walletCurrency, pin).' }, { status: 400 });
  }

  // Mock logic:
  // 1. Verify user's PIN.
  if (pin !== '1234') {
       return NextResponse.json({ success: false, error: 'Invalid PIN.' }, { status: 401 });
  }
  
  // 2. Check balance in the specified wallet.
  // 3. Debit user's wallet.
  // 4. Call card provider's API to fund the card.
  console.log(`[API MOCK] Funding card ${cardId} with ${amount} from ${walletCurrency} wallet.`);

  return NextResponse.json({ 
    success: true, 
    message: `Card ${cardId} has been successfully funded with ${amount} ${walletCurrency}.`,
    transactionId: `mock_fund_txn_${Date.now()}`
  });
}
