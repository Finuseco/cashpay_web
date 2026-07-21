
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getHardwareSignatures } from '@/lib/actions/security.actions';

/**
 * API : Lister les clés émises par l'utilisateur connecté
 * Endpoint: GET /api/v1/security/cpk/list
 */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }

    try {
        const signatures = await getHardwareSignatures(user.id);
        return NextResponse.json({ success: true, data: signatures });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message || "Erreur lors de la récupération" }, { status: 500 });
    }
}
