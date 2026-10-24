import { type NextRequest, NextResponse } from 'next/server';
import { createChessGame } from '@/lib/actions/game.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

/** Crée une vraie partie : la mise est débitée du créateur (même logique que /api/v1/games/chess/create). */
export async function POST(request: NextRequest) {
    const { betAmount, currency } = await request.json().catch(() => ({}));
    if (betAmount === undefined || !currency) {
        return NextResponse.json({ success: false, error: 'Bet amount and currency are required.' }, { status: 400 });
    }
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const result = await createChessGame(user, parseFloat(betAmount), String(currency));
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
