
'use server';

import { db } from '@/lib/db';
import { handleDbError, saveBase64Image } from './helpers';
import type { User } from '@/lib/types';
import type { Event, Ticket, TicketType } from '@/lib/actions/types';
import { getAuthenticatedUser } from './user.actions';
import { createTransaction } from './transaction.actions';
import { countryToCode } from '../utils';
import { createZoomEvent, refreshZoomToken, registerAttendeeForEvent } from '@/services/zoom';

interface CreateEventData {
  name: string;
  description: string;
  location?: string;
  date: Date;
  time: string;
  currency: 'USD' | 'EUR' | 'CDF' | string;
  imageUrl?: string;
  ticketTypes: Omit<TicketType, 'id' | 'sold'>[];
  eventType: 'live' | 'zoom';
}

export async function createEvent(eventData: CreateEventData): Promise<{ success: boolean; event?: Event; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Vous devez être connecté pour créer un événement." };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        let zoomEventId = null;

        // Gestion de l'événement Zoom via le compte de l'utilisateur
        if (eventData.eventType === 'zoom') {
            if (!user.zoom_refresh_token) {
                throw new Error("Veuillez d'abord lier votre compte Zoom dans vos paramètres de sécurité.");
            }

            const tokens = await refreshZoomToken(user.zoom_refresh_token);
            
            const zoomMeeting = await createZoomEvent(tokens.access_token, {
                topic: eventData.name,
                agenda: eventData.description,
                start_time: eventData.date.toISOString(),
            });

            zoomEventId = zoomMeeting.id.toString();

            await connection.query('UPDATE users SET zoom_refresh_token = $1 WHERE id = $2', [tokens.refresh_token, user.id]);
        }

        let imageUrl = eventData.imageUrl;
        if (imageUrl && imageUrl.startsWith('data:image')) {
            const savedImagePath = await saveBase64Image(imageUrl, 'documents', `event_${user.id}_${Date.now()}`);
            if (!savedImagePath) throw new Error("Erreur d'image.");
            imageUrl = savedImagePath;
        }
        
        const userCountryCode = user.country ? countryToCode(user.country) : 'CD';

        const {rows: result} = await connection.query(
            `INSERT INTO events 
            (owner_user_id, owner_country_code, name, description, location, event_date, event_time, image_url, status, currency, event_type, zoom_event_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`, 
            [user.id, userCountryCode, eventData.name, eventData.description, eventData.location || null, eventData.date, eventData.time, imageUrl || null, 'active', eventData.currency, eventData.eventType, zoomEventId]
        );
        const eventId = result[0].id;

        for (const ticketType of eventData.ticketTypes) {
            await connection.query(
                'INSERT INTO event_ticket_types (event_id, type_name, price, quantity_total, quantity_sold) VALUES ($1, $2, $3, $4, $5)', 
                [eventId, ticketType.type, ticketType.price, ticketType.quantity, 0]
            );
        }

        await connection.query('COMMIT');
        const createdEvent = await getEventById(eventId.toString());
        return { success: true, event: createdEvent! };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function purchaseTicket(userId: number, eventId: string, ticketTypeId: number, quantity: number, paymentCurrency: string): Promise<{ success: boolean; error?: string, ticket?: Ticket }> {
  const connection = await db.getConnection();
  try {
    await connection.query('BEGIN');

    const {rows: userRows} = await connection.query('SELECT * from users WHERE id = $1', [userId]);
    const buyer = userRows[0] as User;

    const {rows: ticketTypeRows} = await connection.query('SELECT * FROM event_ticket_types WHERE id = $1 FOR UPDATE', [ticketTypeId]);
    const ticketType = ticketTypeRows[0];

    const {rows: eventRows} = await connection.query(`
        SELECT e.*, u.zoom_refresh_token, u.id as organizer_id
        FROM events e 
        JOIN users u ON e.owner_user_id = u.id 
        WHERE e.id = $1::int`, [ticketType.event_id]);
    const event = eventRows[0];
    
    if ((ticketType.quantity_sold + quantity) > ticketType.quantity_total) throw new Error("Billets épuisés.");

    const totalAmount = parseFloat(ticketType.price) * quantity;

    const transactionResult = await createTransaction({
      user: buyer, typeCode: 'TICKET_BUY', amount: totalAmount, currency: paymentCurrency,
      description: `Achat de ${quantity} billet(s) pour ${event.name}`,
      metadata: { eventId, ticketTypeId, quantity },
      connection: connection
    });

    if (!transactionResult.success) throw new Error(transactionResult.error);

    const tickets = [];
    for (let i = 0; i < quantity; i++) {
        const ticketCode = `TICKET-${eventId}-${userId}-${Date.now()}-${i}`;
        let zoomJoinUrl = null;

        // Si c'est un événement Zoom, on enregistre le participant auprès de Zoom
        if (event.event_type === 'zoom' && event.zoom_event_id && event.zoom_refresh_token) {
            try {
                const tokens = await refreshZoomToken(event.zoom_refresh_token);
                // Mettre à jour le refresh token de l'organisateur
                await connection.query('UPDATE users SET zoom_refresh_token = $1 WHERE id = $2', [tokens.refresh_token, event.organizer_id]);
                
                const registration = await registerAttendeeForEvent(tokens.access_token, event.zoom_event_id, {
                    email: buyer.email || `${buyer.id_wallet}@cashpay.africa`,
                    first_name: buyer.first_name || 'Client',
                    last_name: buyer.last_name || 'CashPay'
                });
                zoomJoinUrl = registration.join_url;
            } catch (zoomError) {
                console.error("[Zoom Registration Failed]", zoomError);
                // On continue l'achat même si Zoom échoue, mais on log l'erreur
            }
        }

        const {rows: result} = await connection.query(
            `INSERT INTO tickets (event_id, ticket_type_id, user_id, ticket_code, status, purchase_transaction_id, zoom_join_url) 
            VALUES ($1::int, $2::int, $3::int, $4, $5, $6::int, $7) RETURNING id`, 
            [eventId, ticketTypeId, userId, ticketCode, 'valid', transactionResult.transactionId, zoomJoinUrl]
        );
        tickets.push({ id: result[0].id.toString(), ownerName: buyer.full_name, ticketType: ticketType.type_name, ticketCode });
    }

    await connection.query('UPDATE event_ticket_types SET quantity_sold = quantity_sold + $1 WHERE id = $2::int', [quantity, ticketTypeId]);
    await connection.query('COMMIT');
    return { success: true, ticket: tickets[0] as Ticket };

  } catch (error: any) {
    await connection.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
}

export async function getEvents(): Promise<Event[]> {
    try {
        const {rows} = await db.query(`
            SELECT e.*, u.full_name as "organizerName" 
            FROM events e
            JOIN users u ON e.owner_user_id = u.id
            WHERE e.status = 'active'
            ORDER BY e.event_date DESC
        `);
        return await Promise.all(rows.map(async (row) => {
            const {rows: tt} = await db.query('SELECT * FROM event_ticket_types WHERE event_id = $1', [row.id]);
            const {rows: val} = await db.query('SELECT COUNT(*) as count FROM tickets WHERE event_id = $1 AND status = $2', [row.id, 'used']);
            return {
                id: row.id.toString(), name: row.name, description: row.description,
                date: new Date(row.event_date).toISOString(), time: row.event_time,
                location: row.location, currency: row.currency, imageUrl: row.image_url,
                organizerName: row.organizerName, ownerUserId: row.owner_user_id,
                ownerCountryCode: row.owner_country_code, eventType: row.event_type,
                zoomEventId: row.zoom_event_id, validatedCount: parseInt(val[0].count),
                ticketTypes: tt.map(t => ({ id: t.id, type: t.type_name, price: parseFloat(t.price), quantity: t.quantity_total, sold: t.quantity_sold }))
            };
        }));
    } catch (e) { return []; }
}

export async function getEventById(eventId: string): Promise<Event | undefined> {
    try {
        const {rows} = await db.query(`SELECT e.*, u.full_name as "organizerName" FROM events e JOIN users u ON e.owner_user_id = u.id WHERE e.id = $1::int`, [eventId]);
        if (rows.length === 0) return undefined;
        const e = rows[0];
        const {rows: tt} = await db.query('SELECT * FROM event_ticket_types WHERE event_id = $1::int', [eventId]);
        const {rows: val} = await db.query('SELECT COUNT(*) as count FROM tickets WHERE event_id = $1::int AND status = $2', [eventId, 'used']);
        return {
            id: e.id.toString(), name: e.name, description: e.description,
            date: new Date(e.event_date).toISOString(), time: e.event_time,
            location: e.location, imageUrl: e.image_url, currency: e.currency,
            organizerName: e.organizerName, ownerUserId: e.owner_user_id,
            ownerCountryCode: e.owner_country_code, eventType: e.event_type,
            zoomEventId: e.zoom_event_id, validatedCount: parseInt(val[0].count),
            ticketTypes: tt.map(t => ({ id: t.id, type: t.type_name, price: parseFloat(t.price), quantity: t.quantity_total, sold: t.quantity_sold }))
        };
    } catch (e) { return undefined; }
}

export async function getEventsForOrganizer(userId: number): Promise<Event[]> {
    try {
        const {rows} = await db.query(`SELECT e.*, u.full_name as "organizerName" FROM events e JOIN users u ON e.owner_user_id = u.id WHERE e.owner_user_id = $1::int`, [userId]);
        return await Promise.all(rows.map(async (row) => {
            const {rows: tt} = await db.query('SELECT * FROM event_ticket_types WHERE event_id = $1::int', [row.id]);
            const {rows: val} = await db.query('SELECT COUNT(*) as count FROM tickets WHERE event_id = $1::int AND status = $2', [row.id, 'used']);
            return {
                id: row.id.toString(), name: row.name, description: row.description,
                date: new Date(row.event_date).toISOString(), time: row.event_time,
                location: row.location, imageUrl: row.image_url, currency: row.currency,
                organizerName: row.organizerName, ownerUserId: row.owner_user_id,
                ownerCountryCode: row.owner_country_code, eventType: row.event_type,
                zoomEventId: row.zoom_event_id, validatedCount: parseInt(val[0].count),
                ticketTypes: tt.map(t => ({ id: t.id, type: t.type_name, price: parseFloat(t.price), quantity: t.quantity_total, sold: t.quantity_sold }))
            };
        }));
    } catch (e) { return []; }
}

export async function validateTicket(eventId: string, ticketCode: string): Promise<{ success: boolean; message: string; ticket?: { ownerName: string; ticketType: string; }; }> {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, message: "Accès non autorisé." };
    try {
        const {rows} = await db.query(`
            SELECT t.*, u.full_name as owner_name, tt.type_name as ticket_type, e.owner_user_id as organizer_id
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            JOIN event_ticket_types tt ON t.ticket_type_id = tt.id
            JOIN events e ON t.event_id = e.id
            WHERE t.ticket_code = $1`, [ticketCode]);
        if (rows.length === 0) return { success: false, message: "Billet non trouvé." };
        const t = rows[0];
        if (t.organizer_id !== user.id) return { success: false, message: "Accès refusé." };
        if (t.event_id.toString() !== eventId) return { success: false, message: "Billet invalide pour cet événement." };
        if (t.status === 'used') return { success: false, message: "Déjà utilisé." };
        await db.query('UPDATE tickets SET status = $1, validation_time = NOW() WHERE id = $2', ['used', t.id]);
        return { success: true, message: "Billet validé.", ticket: { ownerName: t.owner_name, ticketType: t.ticket_type } };
    } catch (e) { return { success: false, message: 'Erreur.' }; }
}

export async function deleteEvent(eventId: string, userId: number): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await connection.query('DELETE FROM tickets WHERE event_id = $1::int', [eventId]);
        await connection.query('DELETE FROM event_ticket_types WHERE event_id = $1::int', [eventId]);
        await connection.query('DELETE FROM events WHERE id = $1::int AND owner_user_id = $2::int', [eventId, userId]);
        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}

export interface EventTicket {
  eventId: string;
  eventName: string;
  date: string;
  time: string;
  location: string;
  imageUrl: string;
  eventType?: 'live' | 'zoom';
  tickets: {
    id: string;
    ticketCode: string;
    ticketType: string;
    status: 'valid' | 'used' | 'invalid' | 'expired';
    ownerName: string;
    zoomJoinUrl?: string | null; 
  }[];
}

export async function getTicketsForUser(userId: number): Promise<EventTicket[]> {
    try {
        const {rows} = await db.query(`
            SELECT 
                t.id as ticket_id, t.ticket_code, t.status, t.zoom_join_url,
                tt.type_name as ticket_type,
                e.id as event_id, e.name as event_name, e.event_date, e.event_time, e.location, e.image_url, e.event_type
            FROM tickets t
            JOIN event_ticket_types tt ON t.ticket_type_id = tt.id
            JOIN events e ON t.event_id = e.id
            WHERE t.user_id = $1::int
            ORDER BY e.event_date DESC`, [userId]);
        const grouped: Record<string, EventTicket> = {};
        for (const t of rows) {
            const id = t.event_id.toString();
            if (!grouped[id]) {
                grouped[id] = { eventId: id, eventName: t.event_name, date: t.event_date, time: t.event_time, location: t.location, imageUrl: t.image_url, eventType: t.event_type, tickets: [] };
            }
            grouped[id].tickets.push({ id: t.ticket_id.toString(), ticketCode: t.ticket_code, ticketType: t.ticket_type, status: t.status, ownerName: '', zoomJoinUrl: t.zoom_join_url });
        }
        return Object.values(grouped);
    } catch(e) { return []; }
}
