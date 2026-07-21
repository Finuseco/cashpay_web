
import { NextResponse } from 'next/server';
import { resolveChessGame } from '@/lib/actions/game.actions';
import { validateApiSignature } from '@/lib/api-security';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

/**
 * API : Clôturer une partie et transférer les fonds au gagnant.
 * Doit être appelé par le client mobile après détection d'un échec et mat ou abandon.
 */
export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    try {
        const { gameId, winnerId } = await request.json();
        
        if (!gameId || !winnerId) {
            return NextResponse.json({ success: false, error: "Paramètres manquants." }, { status: 400 });
        }

        const result = await resolveChessGame(gameId, winnerId);
        
        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
