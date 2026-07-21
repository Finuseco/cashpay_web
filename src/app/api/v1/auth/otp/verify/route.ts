
import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/actions/auth.actions';
import { validateApiSignature } from '@/lib/api-security';

/**
 * API : Vérification de l'OTP (Mobile).
 * Retourne le token JWT souverain.
 */
export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    try {
        const { userId, otp } = await request.json();
        
        if (!userId || !otp) {
            return NextResponse.json({ success: false, error: "Paramètres manquants." }, { status: 400 });
        }

        const result = await verifyOtp(parseInt(userId, 10), otp);
        
        if (!result.success) {
            return NextResponse.json(result, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            token: result.token,
            user: result.user
        });
    } catch (e) {
        return NextResponse.json({ success: false, error: "Erreur interne" }, { status: 500 });
    }
}
