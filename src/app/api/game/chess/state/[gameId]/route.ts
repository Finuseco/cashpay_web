import { type NextRequest, NextResponse } from 'next/server';
import { getGameState } from '@/lib/actions/game.actions';

/** État réel d'une partie (réservé aux deux joueurs, identifiés par la session). */
export async function GET(_request: NextRequest, { params }: { params: { gameId: string } }) {
    const state = await getGameState(parseInt(params.gameId, 10));
    if (!state) return NextResponse.json({ success: false, error: 'Partie introuvable ou accès refusé.' }, { status: 404 });
    const { fullGame, ...rest } = state;
    return NextResponse.json({ success: true, ...rest });
}
