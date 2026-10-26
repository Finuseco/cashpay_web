/**
 * GET /api/v1/meetings/list
 * Réunions récentes de l'utilisateur authentifié (en tant qu'hôte).
 *
 * Query :
 *   limit? : number (défaut 20, max 50)
 *
 * Réponse :
 *   { success, meetings: [ { meetCode, topic, type, status, joinUrl, createdAt } ] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getMyRecentMeetings } from '@/lib/actions/meeting.actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        }

        const limitParam = request.nextUrl.searchParams.get('limit');
        const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50);

        const meetings = await getMyRecentMeetings(limit);

        return NextResponse.json({ success: true, meetings });
    } catch (error: any) {
        console.error('[GET /api/v1/meetings/list]', error?.message);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
