import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { db } from '@/lib/db';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { refreshZoomToken, registerAttendeeForEvent } from '@/services/zoom';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/onchat/events/[id]/buy-ticket
 * Achat d'un ou plusieurs tickets pour un événement.
 *
 * Body JSON:
 *   { ticketTypeId: number, quantity: number, paymentCurrency: string, pin: string }
 *
 * Sécurité :
 *   - userId TOUJOURS issu de la session (jamais du body)
 *   - PIN vérifié côté serveur avant tout débit
 *
 * Utilisé par l'application mobile Android.
 */
export async function POST(
    request: Request,
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

    let body: { ticketTypeId?: number; quantity?: number; paymentCurrency?: string; pin?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Body JSON invalide.' }, { status: 400 });
    }

    const { ticketTypeId, quantity = 1, paymentCurrency = 'USD', pin } = body;

    if (!ticketTypeId || !pin) {
        return NextResponse.json({ success: false, error: 'ticketTypeId et pin sont requis.' }, { status: 400 });
    }

    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 10) {
        return NextResponse.json({ success: false, error: 'Quantité invalide (1-10).' }, { status: 400 });
    }

    // Vérification du PIN
    const pinCheck = await verifyCurrentUserPin(pin);
    if (!pinCheck.success) {
        return NextResponse.json({ success: false, error: pinCheck.error || 'PIN incorrect.' }, { status: 401 });
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // Verrou sur le type de ticket
        const { rows: ttRows } = await connection.query(
            'SELECT * FROM event_ticket_types WHERE id = $1::int FOR UPDATE',
            [ticketTypeId]
        );
        if (ttRows.length === 0) {
            await connection.query('ROLLBACK');
            return NextResponse.json({ success: false, error: 'Type de ticket introuvable.' }, { status: 404 });
        }
        const ticketType = ttRows[0];

        if (String(ticketType.event_id) !== String(eventId)) {
            await connection.query('ROLLBACK');
            return NextResponse.json({ success: false, error: 'Ticket non associé à cet événement.' }, { status: 400 });
        }

        const available = Number(ticketType.quantity_total) - Number(ticketType.quantity_sold);
        if (Number(quantity) > available) {
            await connection.query('ROLLBACK');
            return NextResponse.json({ success: false, error: `Seulement ${available} billet(s) disponible(s).` }, { status: 400 });
        }

        // Infos événement + organisateur
        const { rows: eventRows } = await connection.query(
            `SELECT e.*, u.id AS organizer_id, u.zoom_refresh_token
             FROM events e JOIN users u ON e.owner_user_id = u.id
             WHERE e.id = $1::int`,
            [eventId]
        );
        if (eventRows.length === 0) {
            await connection.query('ROLLBACK');
            return NextResponse.json({ success: false, error: 'Événement introuvable.' }, { status: 404 });
        }
        const event = eventRows[0];

        const totalAmount = parseFloat(ticketType.price) * Number(quantity);

        // Débit du wallet
        const txResult = await createTransaction({
            user,
            typeCode: 'TICKET_BUY',
            amount: totalAmount,
            currency: paymentCurrency,
            description: `Achat de ${quantity} billet(s) — ${event.name}`,
            receiver_id: event.organizer_id,
            metadata: { eventId, ticketTypeId, quantity },
            connection,
        });

        if (!txResult.success) {
            await connection.query('ROLLBACK');
            return NextResponse.json({ success: false, error: txResult.error || 'Paiement échoué.' }, { status: 402 });
        }

        // Création des tickets
        const tickets = [];
        for (let i = 0; i < Number(quantity); i++) {
            const ticketCode = `TKT-${eventId}-${user.id}-${Date.now()}-${i}`;
            let zoomJoinUrl: string | null = null;

            if (event.event_type === 'zoom' && event.zoom_event_id && event.zoom_refresh_token) {
                try {
                    const tokens = await refreshZoomToken(event.zoom_refresh_token);
                    await connection.query(
                        'UPDATE users SET zoom_refresh_token = $1 WHERE id = $2',
                        [tokens.refresh_token, event.organizer_id]
                    );
                    const reg = await registerAttendeeForEvent(tokens.access_token, event.zoom_event_id, {
                        email: user.email || `${user.id_wallet}@cashpay.africa`,
                        first_name: user.first_name || 'Client',
                        last_name: user.last_name || 'CashPay',
                    });
                    zoomJoinUrl = reg.join_url || null;
                } catch (zoomErr) {
                    console.error('[Zoom Registration]', zoomErr);
                }
            }

            const { rows: tRow } = await connection.query(
                `INSERT INTO tickets (event_id, ticket_type_id, user_id, ticket_code, status, purchase_transaction_id, zoom_join_url)
                 VALUES ($1::int, $2::int, $3::int, $4, 'valid', $5::int, $6)
                 RETURNING id`,
                [eventId, ticketTypeId, user.id, ticketCode, txResult.transactionId, zoomJoinUrl]
            );
            tickets.push({
                id: Number(tRow[0].id),
                ticketCode,
                status: 'valid',
                zoomJoinUrl,
            });
        }

        await connection.query(
            'UPDATE event_ticket_types SET quantity_sold = quantity_sold + $1 WHERE id = $2::int',
            [quantity, ticketTypeId]
        );

        await connection.query('COMMIT');

        return NextResponse.json({
            success: true,
            message: `${quantity} billet(s) acheté(s) avec succès.`,
            tickets,
            transactionId: txResult.transactionId,
            amountCharged: totalAmount,
            currency: paymentCurrency,
        });
    } catch (error: any) {
        await connection.query('ROLLBACK').catch(() => {});
        console.error('[OnChat Buy Ticket]', error);
        return NextResponse.json({ success: false, error: error.message || 'Erreur serveur.' }, { status: 500 });
    } finally {
        connection.release();
    }
}
