/**
 * POST /api/v1/meetings/:meetCode/mute-all
 * Coupe le micro de tous les participants non-hôtes.
 * Seul l'hôte de la réunion peut appeler cette route.
 *
 * Le signal est stocké dans meeting_participants via un flag broadcast
 * que les clients lisent au prochain poll de participants.
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

        // Vérifier que l'utilisateur est bien l'hôte
        const { rows } = await db.query(
            `SELECT id, host_user_id FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`,
            [meetCode]
        );
        if (!rows[0]) {
            return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });
        }
        if (Number(rows[0].host_user_id) !== Number(user.id)) {
            return NextResponse.json({ success: false, error: 'Seul l\'hôte peut muter tous les participants.' }, { status: 403 });
        }

        const meetingId = rows[0].id;

        // Retirer la permission de parole à tous les non-hôtes encore connectés
        await db.query(
            `UPDATE meeting_participants
             SET can_speak = false, raise_hand = false
             WHERE meeting_id = $1
               AND user_id != $2
               AND left_at IS NULL`,
            [meetingId, user.id]
        ).catch(() => {});

        return NextResponse.json({ success: true, message: 'Tous les micros ont été coupés.' });
    } catch (error: any) {
        console.error('[mute-all]', error);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
