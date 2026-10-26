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
                    m.created_at AS started_at, u.full_name AS host_name, m.host_user_id,
                    COALESCE(m.scheduled_at, m.created_at) AS scheduled_at,
                    COALESCE(m.duration_min, 0) AS duration_min,
                    COALESCE(m.price_amount, 0) AS price_amount,
                    COALESCE(m.price_currency, 'USD') AS price_currency,
                    (SELECT COUNT(*) FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.left_at IS NULL) AS participants
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
        const isPaid = Number(r.price_amount) > 0;
        const isHost = Number(r.host_user_id) === Number(user.id);

        // Vérifier si l'utilisateur courant a déjà payé
        let alreadyPaid = false;
        if (isPaid && !isHost) {
            const { rows: paidRows } = await db.query(
                `SELECT mp.fee_paid FROM meeting_participants mp
                 JOIN meetings m ON m.id = mp.meeting_id
                 WHERE m.meeting_provider_id = $1 AND mp.user_id = $2
                 LIMIT 1`,
                [meetCode, user.id]
            ).catch(() => ({ rows: [] }));
            alreadyPaid = paidRows.length > 0 && Number(paidRows[0]?.fee_paid) > 0;
        }

        return NextResponse.json({
            success: true,
            meetCode: r.meet_code,
            status: r.status,
            topic: r.topic,
            type: r.type,
            participants: Number(r.participants) || 0,
            startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
            scheduledAt: r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null,
            durationMin: Number(r.duration_min),
            host: r.host_name,
            isHost,
            billing: {
                isPaid,
                priceAmount: Number(r.price_amount),
                priceCurrency: r.price_currency,
                alreadyPaid: isHost || alreadyPaid,
            },
        });
    } catch (error: any) {
        console.error('[GET /api/v1/meetings/:meetCode/status]', error?.message);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
