import { type NextRequest, NextResponse } from 'next/server';
import { forfeitGame } from '@/lib/actions/game.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

/** Abandon réel : l'appelant perd, l'adversaire reçoit le pot (mise × 2). */
export async function POST(request: NextRequest) {
    const { gameId } = await request.json().catch(() => ({}));
    if (!gameId) return NextResponse.json({ success: false, error: 'Game ID is required.' }, { status: 400 });
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const result = await forfeitGame(Number(gameId), user.id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
