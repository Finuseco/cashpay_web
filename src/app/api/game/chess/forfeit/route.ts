
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to forfeit a chess game.
 * MOCK ENDPOINT
 */
export async function POST(request: NextRequest) {
  const { gameId } = await request.json();

  if (!gameId) {
    return NextResponse.json({ success: false, error: 'Game ID is required.' }, { status: 400 });
  }

  // In a real app, this would call `forfeitGame` action and handle payouts.
  console.log(`[Chess API Mock] Forfeiting game: ${gameId}`);
  
  return NextResponse.json({ 
    success: true, 
  });
}
