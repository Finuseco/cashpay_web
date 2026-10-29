/**
 * POST /api/v1/meetings/:meetCode/leave
 * Marque le départ d'un participant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

export async function POST(
    _request: NextRequest,
    { params }: { params: { meetCode: string } }
) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        }

        const meetCode = String(params.meetCode || '').trim();
        const { rows } = await db.query(
            `SELECT id FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`, [meetCode]
        );
        if (!rows[0]) return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });

        await db.query(
            `UPDATE meeting_participants SET left_at = NOW()
             WHERE meeting_id = $1 AND user_id = $2`,
            [rows[0].id, user.id]
        );
        await db.query("SELECT pg_notify('onchat_meetings', $1)", [JSON.stringify({ meetCode })]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
