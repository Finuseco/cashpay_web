/**
 * POST /api/v1/meetings/:meetCode/end
 * Termine une réunion. Seul l'hôte peut terminer.
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
            `SELECT id, host_user_id FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`, [meetCode]
        );
        if (!rows[0]) return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });

        if (Number(rows[0].host_user_id) !== Number(user.id)) {
            return NextResponse.json({ success: false, error: 'Seul l\'hôte peut terminer la réunion.' }, { status: 403 });
        }

        await db.query(`UPDATE meetings SET status = 'ended' WHERE id = $1`, [rows[0].id]);
        await db.query(
            `UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = $1 AND left_at IS NULL`,
            [rows[0].id]
        ).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
