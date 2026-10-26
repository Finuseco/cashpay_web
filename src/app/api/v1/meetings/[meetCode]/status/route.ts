/**
 * GET /api/v1/meetings/:meetCode/status
 * Retourne le statut live d'une réunion (utilisé pour le polling dans le chat).
 *
 * Réponse :
 *   { success, meetCode, status, topic, type, participants, startedAt, host }
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

export async function GET(
    _request: NextRequest,
    { params }: { params: { meetCode: string } }
) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        }

        const meetCode = String(params.meetCode || '').trim();
        if (!meetCode) {
            return NextResponse.json({ success: false, error: 'Code de réunion manquant.' }, { status: 400 });
        }

        const { rows } = await db.query(
            `SELECT m.meeting_provider_id AS meet_code, m.status, m.topic, m.type,
                    m.created_at AS started_at, u.full_name AS host_name,
                    (SELECT COUNT(*) FROM meeting_participants mp WHERE mp.meeting_id = m.id) AS participants
             FROM meetings m
             JOIN users u ON u.id = m.host_user_id
             WHERE m.meeting_provider_id = $1
             LIMIT 1`,
            [meetCode]
        );

        if (!rows[0]) {
            return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });
        }

        const r = rows[0];
        return NextResponse.json({
            success: true,
            meetCode: r.meet_code,
            status: r.status,
            topic: r.topic,
            type: r.type,
            participants: Number(r.participants) || 0,
            startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
            host: r.host_name,
        });
    } catch (error: any) {
        console.error('[GET /api/v1/meetings/:meetCode/status]', error?.message);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
