/**
 * GET /api/v1/meetings/:meetCode/participants
 * Liste des participants actifs d'une réunion avec leur statut.
 *
 * Réponse :
 *   { success, participants: [{ userId, name, avatar, isHost, role, raiseHand, canSpeak, joinedAt }] }
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

        const { rows: meetRows } = await db.query(
            `SELECT id, host_user_id, status FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`,
            [meetCode]
        );
        if (!meetRows[0]) {
            return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });
        }

        // meeting_participants peut ne pas avoir les colonnes raise_hand/can_speak/role
        const { rows } = await db.query(
            `SELECT
                mp.user_id,
                u.full_name AS name,
                u.profile_photo AS avatar,
                mp.is_host,
                COALESCE(mp.role, CASE WHEN mp.is_host THEN 'host' ELSE 'viewer' END) AS role,
                COALESCE(mp.raise_hand, FALSE) AS raise_hand,
                COALESCE(mp.can_speak, mp.is_host, FALSE) AS can_speak,
                mp.joined_at
             FROM meeting_participants mp
             JOIN users u ON u.id = mp.user_id
             WHERE mp.meeting_id = $1 AND mp.left_at IS NULL
             ORDER BY mp.is_host DESC, mp.joined_at ASC`,
            [meetRows[0].id]
        ).catch(async () => {
            // Table ou colonnes inexistantes — retourner liste vide
            return { rows: [] };
        });

        return NextResponse.json({
            success: true,
            meetingStatus: meetRows[0].status,
            hostUserId: meetRows[0].host_user_id,
            participants: rows.map((r: any) => ({
                userId: r.user_id,
                name: r.name || 'Participant',
                avatar: r.avatar || null,
                isHost: Boolean(r.is_host),
                role: r.role || 'viewer',
                raiseHand: Boolean(r.raise_hand),
                canSpeak: Boolean(r.can_speak),
                joinedAt: r.joined_at ? new Date(r.joined_at).toISOString() : null,
            })),
        });
    } catch (error: any) {
        console.error('[GET /api/v1/meetings/:meetCode/participants]', error?.message);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
