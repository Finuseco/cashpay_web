
import { NextResponse } from 'next/server';
import { findUserForLogin } from '@/lib/actions/auth.actions';
import { validateApiSignature } from '@/lib/api-security';

/**
 * API : Initiation de connexion (Mobile).
 * Vérifie l'existence du Wallet ID et retourne les méthodes de défi (OTP/PIN).
 */
export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    try {
        const { walletId } = await request.json();
        if (!walletId) return NextResponse.json({ success: false, error: "Wallet ID requis." }, { status: 400 });

        const result = await findUserForLogin(walletId);
        
        if (!result.success) {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Erreur interne" }, { status: 500 });
    }
}
