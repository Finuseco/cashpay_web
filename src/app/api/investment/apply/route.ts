
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to handle a term deposit application.
 * This is a mock endpoint.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { amount, duration_months, currency, pin } = await request.json();

  if (!amount || !duration_months || !currency || !pin) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }

  // Mock logic:
  // 1. Verify user's PIN.
  if (pin !== '1234') {
       return NextResponse.json({ success: false, error: 'Invalid PIN.' }, { status: 401 });
  }
  
  // 2. Check user's balance.
  // 3. Debit user's wallet for the amount.
  // 4. Create the term deposit record in the database.
  console.log(`[API MOCK] Processing term deposit application for ${amount} ${currency} over ${duration_months} months.`);

  return NextResponse.json({ 
    success: true, 
    message: `Your term deposit application has been submitted and is under review.`,
    applicationId: `mock_dat_app_${Date.now()}`
  });
}
