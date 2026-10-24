import { type NextRequest, NextResponse } from 'next/server';
import { joinChessGame } from '@/lib/actions/game.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

/** Rejoint une vraie partie : la mise est débitée du second joueur. */
export async function POST(request: NextRequest) {
    const { gameCode } = await request.json().catch(() => ({}));
    if (!gameCode) return NextResponse.json({ success: false, error: 'Game code is required.' }, { status: 400 });
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const result = await joinChessGame(user, String(gameCode));
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
}
