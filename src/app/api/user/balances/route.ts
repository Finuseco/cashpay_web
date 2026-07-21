import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to fetch user's wallet balances.
 * This should be an authenticated route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  // Mock data: User's wallet balances
  const mockBalances = [
      { code: 'USD', name: 'US Dollar', balance: '1,250.75', symbol: '$' },
      { code: 'EUR', name: 'Euro', balance: '850.00', symbol: '€' },
      { code: 'CDF', name: 'Franc Congolais', balance: '5,430,000.00', symbol: 'FC' },
  ];
  
  return NextResponse.json({ success: true, balances: mockBalances });
}
