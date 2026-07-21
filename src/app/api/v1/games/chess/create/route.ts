
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createChessGame } from '@/lib/actions/game.actions';
import { validateApiSignature } from '@/lib/api-security';

/**
 * API : Créer une partie d'échecs monétisée (Mobile).
 * Nécessite un Bearer Token valide et une signature HMAC.
 */
export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    try {
        const { betAmount, currency } = await request.json();
        
        if (!betAmount || !currency) {
            return NextResponse.json({ success: false, error: "Montant et devise requis." }, { status: 400 });
        }

        const result = await createChessGame(user, parseFloat(betAmount), currency);
        
        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
