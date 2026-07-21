
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

/**
 * API : Profil actuel (Mobile).
 * Permet de vérifier la validité du token stocké dans l'application.
 */
export async function GET(request: Request) {
    const user = await getAuthenticatedUser();
    
    if (!user) {
        return NextResponse.json({ success: false, error: "Token invalide ou expiré." }, { status: 401 });
    }

    return NextResponse.json({
        success: true,
        user
    });
}
