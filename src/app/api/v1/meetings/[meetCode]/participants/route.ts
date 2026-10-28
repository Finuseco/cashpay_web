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

        const isHost = Number(meetRows[0].host_user_id) === Number(user.id);
        if (!isHost) {
            const access = await db.query('SELECT 1 FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2 AND left_at IS NULL', [meetRows[0].id, user.id]);
            if (!access.rows.length) return NextResponse.json({ success: false, error: 'Accès réservé aux participants.' }, { status: 403 });
        }
        let revenue = [];
        if (isHost) {
            const receipts = await db.query(`SELECT
              COALESCE(NULLIF(metadata->>'original_currency', ''), currency) AS currency,
              SUM(CASE WHEN (metadata->>'original_amount') ~ '^[0-9]+([.][0-9]+)?$' THEN (metadata->>'original_amount')::numeric ELSE amount END) AS amount,
              COUNT(*) AS payments
              FROM transactions WHERE receiver_id = $1 AND status = 'Completed'
                AND (metadata->>'meetingId' = $2 OR metadata->>'eventId' IN (SELECT id::text FROM events WHERE onchat_meeting_id = $3))
              GROUP BY COALESCE(NULLIF(metadata->>'original_currency', ''), currency)`, [user.id, String(meetRows[0].id), meetRows[0].id]);
            revenue = receipts.rows.map(row => ({ currency: row.currency, amount: Number(row.amount), payments: Number(row.payments) }));
        }

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
        );

        return NextResponse.json({
            success: true,
            isHost,
            revenue: isHost ? revenue : undefined,
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
