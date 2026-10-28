import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/onchat/events/my-tickets
 * Retourne tous les tickets achetés par l'utilisateur connecté.
 * Utilisé par l'application mobile Android.
 */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    try {
        const { rows } = await db.query(
            `SELECT
                t.id,
                t.ticket_code AS "ticketCode",
                t.status,
                t.zoom_join_url AS "zoomJoinUrl",
                t.created_at AS "purchasedAt",
                e.id AS "eventId",
                e.name AS "eventName",
                e.event_date AS "eventDate",
                e.event_time AS "eventTime",
                e.location AS "eventLocation",
                e.image_url AS "eventImageUrl",
                e.currency AS "eventCurrency",
                e.event_type AS "eventType", e.onchat_meeting_id, m.join_url AS "onchatJoinUrl",
                ett.type_name AS "ticketType",
                ett.price AS "ticketPrice",
                u.full_name AS "organizerName"
             FROM tickets t
             JOIN events e ON t.event_id = e.id
             JOIN event_ticket_types ett ON t.ticket_type_id = ett.id
             JOIN users u ON e.owner_user_id = u.id
             LEFT JOIN meetings m ON m.id = e.onchat_meeting_id
             WHERE t.user_id = $1::int
             ORDER BY t.created_at DESC`,
            [user.id]
        );

        return NextResponse.json({
            success: true,
            tickets: rows.map(r => ({
                id: Number(r.id),
                ticketCode: r.ticketCode,
                status: r.status,
                zoomJoinUrl: r.zoomJoinUrl || null,
                onchatJoinUrl: r.onchatJoinUrl ? `${r.onchatJoinUrl}?ticket=${encodeURIComponent(r.ticketCode)}` : null,
                purchasedAt: r.purchasedAt,
                event: {
                    id: String(r.eventId),
                    title: r.eventName,
                    date: r.eventDate,
                    time: r.eventTime || null,
                    location: r.eventLocation || null,
                    imageUrl: r.eventImageUrl || null,
                    currency: r.eventCurrency || 'USD',
                    type: r.onchat_meeting_id ? 'onchat' : r.eventType || 'live',
                    organizerName: r.organizerName || null,
                },
                ticketType: r.ticketType,
                ticketPrice: Number(r.ticketPrice),
            })),
            count: rows.length,
        });
    } catch (error: any) {
        console.error('[OnChat My Tickets]', error);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
