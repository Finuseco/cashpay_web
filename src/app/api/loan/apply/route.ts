
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to handle a loan application.
 * This is a mock endpoint.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { amount, duration_months, purpose, currency, pin } = await request.json();

  if (!amount || !duration_months || !purpose || !currency || !pin) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }

  // Mock logic:
  // 1. Verify user's PIN.
  if (pin !== '1234') {
       return NextResponse.json({ success: false, error: 'Invalid PIN.' }, { status: 401 });
  }
  
  // 2. Check user's eligibility for the loan amount.
  // 3. Save the loan application to the database with a 'pending' status.
  console.log(`[API MOCK] Processing loan application for ${amount} ${currency} over ${duration_months} months for ${purpose}.`);

  return NextResponse.json({ 
    success: true, 
    message: `Your loan application has been submitted and is under review.`,
    applicationId: `mock_loan_app_${Date.now()}`
  });
}
