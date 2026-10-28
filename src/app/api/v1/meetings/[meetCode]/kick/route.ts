/**
 * POST /api/v1/meetings/:meetCode/kick
 * Expulse un participant de la réunion.
 * Seul l'hôte peut expulser. L'hôte ne peut pas s'expulser lui-même.
 *
 * Body JSON: { targetUserId: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

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

        let body: { targetUserId?: number };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Body JSON invalide.' }, { status: 400 });
        }

        const targetUserId = Number(body.targetUserId);
        if (!targetUserId || isNaN(targetUserId)) {
            return NextResponse.json({ success: false, error: 'targetUserId requis.' }, { status: 400 });
        }

        if (targetUserId === Number(user.id)) {
            return NextResponse.json({ success: false, error: 'Vous ne pouvez pas vous expulser vous-même.' }, { status: 400 });
        }

        // Vérifier que l'utilisateur est l'hôte
        const { rows } = await db.query(
            `SELECT id, host_user_id FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`,
            [meetCode]
        );
        if (!rows[0]) {
            return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });
        }
        if (Number(rows[0].host_user_id) !== Number(user.id)) {
            return NextResponse.json({ success: false, error: 'Seul l\'hôte peut expulser des participants.' }, { status: 403 });
        }

        const meetingId = rows[0].id;

        // Marquer le participant comme parti (expulsion = left_at NOW)
        await db.query(
            `UPDATE meeting_participants
             SET left_at = NOW(), can_speak = false, raise_hand = false
             WHERE meeting_id = $1 AND user_id = $2`,
            [meetingId, targetUserId]
        );

        return NextResponse.json({ success: true, message: 'Participant expulsé.' });
    } catch (error: any) {
        console.error('[kick]', error);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
