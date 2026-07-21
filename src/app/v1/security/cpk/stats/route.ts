
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getHardwareKeyStats } from '@/lib/actions/security.actions';

/**
 * API : Récupérer les statistiques du coffre-fort USB de l'utilisateur
 * Endpoint: GET /api/v1/security/cpk/stats
 */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }

    try {
        const stats = await getHardwareKeyStats(user.id);
        if (!stats) {
            return NextResponse.json({ success: false, error: "Impossible de calculer les statistiques" }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: stats });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
