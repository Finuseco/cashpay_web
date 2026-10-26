/**
 * POST /api/v1/meetings/:meetCode/raise-hand
 * Un participant lève la main pour demander la parole.
 * Body: { raised: boolean }  — true = lever, false = baisser
 *
 * Réponse : { success, raised }
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
    `).catch(() => {/* table may not exist yet — ok */});
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
        const raised = body.raised !== false; // default: raise

        const { rows } = await db.query(
            `SELECT id FROM meetings WHERE meeting_provider_id = $1 AND status != 'ended' LIMIT 1`,
            [meetCode]
        );
        if (!rows[0]) {
            return NextResponse.json({ success: false, error: 'Réunion introuvable ou terminée.' }, { status: 404 });
        }

        await ensureParticipantColumns();

        await db.query(
            `UPDATE meeting_participants SET raise_hand = $1 WHERE meeting_id = $2 AND user_id = $3`,
            [raised, rows[0].id, user.id]
        );

        return NextResponse.json({ success: true, raised });
    } catch (error: any) {
        console.error('[POST /api/v1/meetings/:meetCode/raise-hand]', error?.message);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
