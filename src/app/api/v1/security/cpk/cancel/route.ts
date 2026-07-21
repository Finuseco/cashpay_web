
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { cancelHardwareSignature } from '@/lib/actions/security.actions';

/**
 * API : Annuler une signature et récupérer le capital
 */
export async function POST(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { reference, pin } = body;

        if (!reference || !pin) {
            return NextResponse.json({ success: false, error: "Référence et PIN requis" }, { status: 400 });
        }

        const result = await cancelHardwareSignature({
            reference,
            userId: user.id,
            pin
        });

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Erreur interne" }, { status: 500 });
    }
}
