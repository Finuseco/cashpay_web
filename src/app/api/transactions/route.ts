import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to fetch transaction history.
 * This should be an authenticated route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  // Mock data: A list of recent transactions
  const mockTransactions = [
    { type: 'sent', description: 'Transfert à John Doe', date: '25/07/2024', time: '14:30', amount: '50.00', currency: 'USD', reference: 'TR-123' },
    { type: 'received', description: 'Dépôt de Jane Smith', date: '25/07/2024', time: '10:15', amount: '100.00', currency: 'USD', reference: 'DP-456' },
    { type: 'sent', description: 'Paiement Marchand - Supermarché', date: '24/07/2024', time: '18:45', amount: '25.50', currency: 'USD', reference: 'PM-789' },
  ];
  
  return NextResponse.json({ success: true, transactions: mockTransactions });
}
