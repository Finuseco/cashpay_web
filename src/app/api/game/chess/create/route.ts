
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to create a new chess game.
 * MOCK ENDPOINT
 */
export async function POST(request: NextRequest) {
  const { betAmount, currency } = await request.json();

  if (betAmount === undefined || !currency) {
    return NextResponse.json({ success: false, error: 'Bet amount and currency are required.' }, { status: 400 });
  }

  // In a real app, this would call `createChessGame` action and debit the user.
  console.log(`[Chess API Mock] Creating game with bet: ${betAmount} ${currency}`);
  
  const mockGameId = Math.floor(Math.random() * 10000);
  const mockGameCode = `CH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  return NextResponse.json({ 
    success: true, 
    gameId: mockGameId,
    gameCode: mockGameCode,
  });
}
