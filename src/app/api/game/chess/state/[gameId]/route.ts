
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to get the current state of a chess game.
 * MOCK ENDPOINT
 */
export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
  const gameId = params.gameId;

  console.log(`[Chess API Mock] Fetching state for game: ${gameId}`);
  
  // In a real app, this would call `getGameState` action.
  return NextResponse.json({ 
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    turn: "black",
    history: ["e4"],
    // ... other game state info
  });
}
