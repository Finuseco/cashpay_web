
import { NextResponse } from 'next/server';
import { verifyPinAndCreateSession } from '@/lib/actions/auth.actions';
import { validateApiSignature } from '@/lib/api-security';

/**
 * API : Vérification du PIN (Mobile).
 * Retourne le token JWT souverain si le PIN est correct.
 */
export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    try {
        const { userId, pin } = await request.json();
        
        if (!userId || !pin) {
            return NextResponse.json({ success: false, error: "Paramètres manquants." }, { status: 400 });
        }

        const result = await verifyPinAndCreateSession(parseInt(userId, 10), pin);
        
        if (!result.success) {
            return NextResponse.json(result, { status: 401 });
        }

        // On génère le token manuellement pour le renvoyer en JSON (le helper de session met aussi un cookie)
        const { generateToken } = await import('@/lib/jwt');
        const token = generateToken(result.user);

        return NextResponse.json({
            success: true,
            token: token,
            user: result.user
        });
    } catch (e) {
        return NextResponse.json({ success: false, error: "Erreur interne" }, { status: 500 });
    }
}
