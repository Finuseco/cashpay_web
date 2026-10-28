import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/onchat/events/[id]
 * Retourne les détails d'un événement (types de tickets, prix, disponibilités).
 * Utilisé par l'application mobile Android.
 */
export async function GET(
    _request: Request,
    { params }: { params: { id: string } }
) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const eventId = params.id;
    if (!eventId || isNaN(Number(eventId))) {
        return NextResponse.json({ success: false, error: 'ID événement invalide.' }, { status: 400 });
    }

    try {
        const { rows: eventRows } = await db.query(
            `SELECT e.*, u.full_name AS "organizerName", u.profile_photo_url AS "organizerPhoto"
             FROM events e
             JOIN users u ON e.owner_user_id = u.id
             WHERE e.id = $1::int AND e.status = 'active'`,
            [eventId]
        );

        if (eventRows.length === 0) {
            return NextResponse.json({ success: false, error: 'Événement introuvable.' }, { status: 404 });
        }

        const event = eventRows[0];

        const { rows: ticketTypes } = await db.query(
            `SELECT id, type_name AS type, price, quantity_total AS quantity, quantity_sold AS sold
             FROM event_ticket_types WHERE event_id = $1::int ORDER BY price ASC`,
            [eventId]
        );

        // Vérifier si l'utilisateur a déjà acheté un ticket
        const { rows: myTickets } = await db.query(
            `SELECT id, ticket_code AS "ticketCode", status, zoom_join_url AS "zoomJoinUrl"
             FROM tickets WHERE event_id = $1::int AND user_id = $2::int`,
            [eventId, user.id]
        );

        return NextResponse.json({
            success: true,
            event: {
                id: String(event.id),
                title: event.name,
                description: event.description || '',
                imageUrl: event.image_url || null,
                date: event.event_date,
                time: event.event_time || null,
                location: event.location || null,
                currency: event.currency || 'USD',
                eventType: event.event_type || 'live',
                organizerName: event.organizerName || null,
                organizerPhoto: event.organizerPhoto || null,
                ticketTypes: ticketTypes.map(tt => ({
                    id: Number(tt.id),
                    type: tt.type,
                    price: Number(tt.price),
                    quantity: Number(tt.quantity),
                    sold: Number(tt.sold),
                    available: Number(tt.quantity) - Number(tt.sold),
                })),
                myTickets: myTickets.map(t => ({
                    id: Number(t.id),
                    ticketCode: t.ticketCode,
                    status: t.status,
                    zoomJoinUrl: t.zoomJoinUrl || null,
                })),
            },
        });
    } catch (error: any) {
        console.error('[OnChat Events Detail]', error);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
