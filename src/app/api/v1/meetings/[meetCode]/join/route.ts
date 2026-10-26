/**
 * POST /api/v1/meetings/:meetCode/join
 * Enregistre la présence d'un participant à une réunion.
 * Crée la table meeting_participants si elle n'existe pas.
 *
 * Réponse :
 *   { success, meetCode, joinUrl, topic, type, participants }
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

async function ensureParticipantsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS meeting_participants (
            id         SERIAL PRIMARY KEY,
            meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            joined_at  TIMESTAMPTZ DEFAULT NOW(),
            left_at    TIMESTAMPTZ,
            is_host    BOOLEAN DEFAULT FALSE,
            UNIQUE(meeting_id, user_id)
        );
    `);
}

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
        if (!meetCode) {
            return NextResponse.json({ success: false, error: 'Code de réunion manquant.' }, { status: 400 });
        }

        const { rows } = await db.query(
            `SELECT id, status, topic, type, join_url, host_user_id FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`,
            [meetCode]
        );

        if (!rows[0]) {
            return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });
        }

        const meeting = rows[0];
        if (meeting.status === 'ended') {
            return NextResponse.json({ success: false, error: 'Cette réunion est terminée.' }, { status: 410 });
        }

        // Enregistrer la présence
        await ensureParticipantsTable();
        await db.query(
            `INSERT INTO meeting_participants (meeting_id, user_id, is_host, joined_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (meeting_id, user_id) DO UPDATE SET joined_at = NOW(), left_at = NULL`,
            [meeting.id, user.id, meeting.host_user_id === user.id]
        );

        // Compter les participants
        const { rows: countRows } = await db.query(
            `SELECT COUNT(*) AS cnt FROM meeting_participants WHERE meeting_id = $1 AND left_at IS NULL`,
            [meeting.id]
        );

        return NextResponse.json({
            success: true,
            meetCode,
            joinUrl: meeting.join_url,
            topic: meeting.topic,
            type: meeting.type,
            participants: Number(countRows[0]?.cnt) || 1,
        });
    } catch (error: any) {
        console.error('[POST /api/v1/meetings/:meetCode/join]', error?.message);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
