
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to fetch a user's investment history.
 * This is a mock endpoint.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  // Mock data: A list of user's investments
  const mockInvestmentHistory = [
    { 
        id: 1,
        type: 'Term Deposit',
        amount: 1000.00,
        currency: 'USD',
        status: 'matured',
        start_date: '2023-01-15',
        maturity_date: '2024-01-15',
        return_amount: 1439.20
    },
    { 
        id: 2, 
        type: 'Term Deposit',
        amount: 5000.00,
        currency: 'USD',
        status: 'active',
        start_date: '2024-06-01',
        maturity_date: '2025-06-01',
        return_amount: 7196.00
    },
  ];
  
  return NextResponse.json({ success: true, history: mockInvestmentHistory });
}
