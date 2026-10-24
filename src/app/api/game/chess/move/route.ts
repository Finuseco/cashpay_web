import { type NextRequest, NextResponse } from 'next/server';
import { makeMove } from '@/lib/actions/game.actions';

/** Joue un coup : validé et rejoué par le serveur (tour, légalité, mat/pat, règlement des gains). */
export async function POST(request: NextRequest) {
    const { gameId, move, promotion } = await request.json().catch(() => ({}));
    if (!gameId || !move || !move.from || !move.to) {
        return NextResponse.json({ success: false, error: 'Game ID and move are required.' }, { status: 400 });
    }
    const result = await makeMove(Number(gameId), move, undefined, promotion);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
