
import { NextResponse } from 'next/server';
import { getGameState } from '@/lib/actions/game.actions';
import { validateApiSignature } from '@/lib/api-security';

export async function GET(request: Request, { params }: { params: { gameId: string } }) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    try {
        const state = await getGameState(parseInt(params.gameId, 10));
        if (!state) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
        return NextResponse.json({ success: true, data: state });
    } catch (e) {
        return NextResponse.json({ success: false, error: "Error" }, { status: 500 });
    }
}
