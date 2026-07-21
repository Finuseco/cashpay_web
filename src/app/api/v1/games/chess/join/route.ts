
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { joinChessGame } from '@/lib/actions/game.actions';
import { validateApiSignature } from '@/lib/api-security';

export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    try {
        const { gameCode } = await request.json();
        if (!gameCode) return NextResponse.json({ success: false, error: "Code requis." }, { status: 400 });

        const result = await joinChessGame(user, gameCode);
        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Error" }, { status: 500 });
    }
}
