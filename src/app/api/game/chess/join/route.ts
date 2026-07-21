
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to join an existing chess game.
 * MOCK ENDPOINT
 */
export async function POST(request: NextRequest) {
  const { gameCode } = await request.json();

  if (!gameCode) {
    return NextResponse.json({ success: false, error: 'Game code is required.' }, { status: 400 });
  }
  
  if (gameCode.toUpperCase() === 'INVALID') {
    return NextResponse.json({ success: false, error: 'Partie non trouvée ou déjà pleine' }, { status: 404 });
  }

  // In a real app, this would call `joinChessGame` action.
  console.log(`[Chess API Mock] Joining game with code: ${gameCode}`);
  
  return NextResponse.json({ 
    success: true, 
    gameId: 12345, // mock ID
    opponent: {
        name: "John Doe",
        avatar: "https://placehold.co/100x100.png"
    }
  });
}
