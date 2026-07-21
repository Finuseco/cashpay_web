
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to get a user's casino/game transaction history.
 * MOCK ENDPOINT
 */
export async function GET(request: NextRequest) {
  // In a real app, you would get the user ID from the authenticated session.
  const mockUserId = 1; 

  console.log(`[Casino History API Mock] Fetching history for user: ${mockUserId}`);
  
  const mockHistory = [
    { type: 'win', description: "Partie d'échecs contre John Doe", amount: 2000, currency: 'CDF', timestamp: new Date().toISOString() },
    { type: 'bet', description: "Mise pour partie d'échecs", amount: -1000, currency: 'CDF', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { type: 'deposit', description: "Dépôt sur le portefeuille de jeu", amount: 5000, currency: 'CDF', timestamp: new Date(Date.now() - 86400000).toISOString() },
  ];

  return NextResponse.json({ 
    success: true,
    data: mockHistory
  });
}
