/**
 * POST /api/v1/meetings/:meetCode/grant-speech
 * L'hôte accorde ou retire le droit de parole à un participant.
 * Body: { targetUserId: number, canSpeak: boolean, role?: 'speaker'|'viewer' }
 *
 * Seul l'hôte peut appeler cette route.
 * Réponse : { success, targetUserId, canSpeak }
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

async function ensureParticipantColumns() {
    await db.query(`
        ALTER TABLE meeting_participants
            ADD COLUMN IF NOT EXISTS raise_hand BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS can_speak   BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS role        VARCHAR(20) DEFAULT 'viewer'
    `).catch(() => {});
}

export async function POST(
    request: NextRequest,
    { params }: { params: { meetCode: string } }
) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        }

        const meetCode = String(params.meetCode || '').trim();
        const body = await request.json().catch(() => ({}));
        const targetUserId = Number(body.targetUserId);
        const canSpeak    = body.canSpeak !== false;
        const role        = canSpeak ? 'speaker' : 'viewer';

        if (!targetUserId) {
            return NextResponse.json({ success: false, error: 'targetUserId requis.' }, { status: 400 });
        }

        // Vérifier que l'appelant est bien l'hôte
        const { rows } = await db.query(
            `SELECT id, host_user_id FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`,
            [meetCode]
        );
        if (!rows[0]) {
            return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });
        }
        if (Number(rows[0].host_user_id) !== Number(user.id)) {
            return NextResponse.json({ success: false, error: 'Seul l\'hôte peut accorder la parole.' }, { status: 403 });
        }

        await ensureParticipantColumns();

        await db.query(
            `UPDATE meeting_participants
             SET can_speak = $1, role = $2, raise_hand = FALSE
             WHERE meeting_id = $3 AND user_id = $4`,
            [canSpeak, role, rows[0].id, targetUserId]
        );

        return NextResponse.json({ success: true, targetUserId, canSpeak, role });
    } catch (error: any) {
        console.error('[POST /api/v1/meetings/:meetCode/grant-speech]', error?.message);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
