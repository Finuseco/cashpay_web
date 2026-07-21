
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to fetch a user's loan history.
 * This is a mock endpoint.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  // Mock data: A list of user's loans
  const mockLoanHistory = [
    { 
        id: 1, 
        amount: 500.00,
        currency: 'USD',
        status: 'repaid',
        request_date: '2023-01-15',
        approval_date: '2023-01-16',
        repayment_date: '2023-07-15'
    },
    { 
        id: 2, 
        amount: 1200.00,
        currency: 'USD',
        status: 'approved',
        request_date: '2024-05-20',
        approval_date: '2024-05-21',
        remaining_balance: 800.00,
        next_payment_due: '2024-08-21'
    },
  ];
  
  return NextResponse.json({ success: true, history: mockLoanHistory });
}
