
'use server';

import { db } from '@/lib/db';
import { handleDbError, saveBase64Image } from './helpers';
import type { User } from '@/lib/types';
import type { Event, Ticket, TicketType } from '@/lib/actions/types';
import { getAuthenticatedUser } from './user.actions';
import { createTransaction } from './transaction.actions';
import { countryToCode } from '../utils';
import crypto from 'crypto';
import { buyEventTickets } from '@/lib/ticket-purchase';

interface CreateEventData {
  name: string;
  description: string;
  location?: string;
  date: Date;
  time: string;
  currency: 'USD' | 'EUR' | 'CDF' | string;
  imageUrl?: string;
  ticketTypes: Omit<TicketType, 'id' | 'sold'>[];
  eventType: 'live' | 'onchat' | 'zoom';
}

export async function createEvent(eventData: CreateEventData): Promise<{ success: boolean; event?: Event; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Vous devez être connecté pour créer un événement." };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        if (!['live', 'onchat', 'zoom'].includes(eventData.eventType)) throw new Error('Type d’événement invalide.');
        if (eventData.eventType === 'zoom') throw new Error('Créez un événement local ou OnChat Meet. Les nouvelles ventes Zoom sont fermées.');
        if (!eventData.ticketTypes.length || eventData.ticketTypes.some(t => !Number.isFinite(t.price) || t.price < 0 || !Number.isInteger(t.quantity) || t.quantity <= 0)) throw new Error('Tarifs ou quantités de billets invalides.');
        let onchatMeetingId: number | null = null;
        let onchatJoinUrl: string | undefined;
        if (eventData.eventType === 'onchat') {
            const code = crypto.randomUUID();
            const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/feedback/meet/${code}`;
            const { rows } = await connection.query(`INSERT INTO meetings (host_user_id, topic, meeting_provider_id, join_url, type, status, price_amount, price_currency)
              VALUES ($1, $2, $3, $4, 'video', 'active', 0, $5) RETURNING id`, [user.id, eventData.name, code, joinUrl, eventData.currency]);
            onchatMeetingId = rows[0].id;
            onchatJoinUrl = joinUrl;
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
            (owner_user_id, owner_country_code, name, description, location, event_date, event_time, image_url, status, currency, event_type, onchat_meeting_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [user.id, userCountryCode, eventData.name, eventData.description, eventData.location || null, eventData.date, eventData.time, imageUrl || null, 'active', eventData.currency, 'live', onchatMeetingId]
        );
        const eventId = result[0].id;

        const savedTicketTypes: TicketType[] = [];
        for (const ticketType of eventData.ticketTypes) {
            const saved = await connection.query(
                'INSERT INTO event_ticket_types (event_id, type_name, price, quantity_total, quantity_sold) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [eventId, ticketType.type, ticketType.price, ticketType.quantity, 0]
            );
            savedTicketTypes.push({ ...ticketType, id: Number(saved.rows[0].id), sold: 0 });
        }

        await connection.query('COMMIT');
        return { success: true, event: {
            id: String(eventId), name: eventData.name, description: eventData.description,
            location: eventData.location || '', date: eventData.date.toISOString(), time: eventData.time,
            currency: eventData.currency, imageUrl: imageUrl || undefined, organizerName: user.full_name,
            ownerUserId: user.id, ownerCountryCode: userCountryCode || 'CD', validatedCount: 0,
            eventType: eventData.eventType, onchatJoinUrl, ticketTypes: savedTicketTypes,
        } };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function purchaseTicket(userId: number, eventId: string, ticketTypeId: number, quantity: number, paymentCurrency: string, pin?: string, maxDebit?: number): Promise<{ success: boolean; error?: string; ticket?: Ticket }> {
    const user = await getAuthenticatedUser();
    if (!user || user.id !== userId) return { success: false, error: 'Authentification requise.' };
    try { return await buyEventTickets(user, eventId, ticketTypeId, quantity, paymentCurrency, pin, maxDebit) as any; }
    catch (error) { return { success: false, error: (error as Error).message }; }
}

export async function getEvents(): Promise<Event[]> {
    try {
        const {rows} = await db.query(`
            SELECT e.*, m.join_url AS onchat_join_url, u.full_name as "organizerName"
            FROM events e
            JOIN users u ON e.owner_user_id = u.id LEFT JOIN meetings m ON m.id = e.onchat_meeting_id
            WHERE e.status = 'active'
              AND (e.event_date + COALESCE(e.event_time, TIME '23:59:59')) >= CURRENT_TIMESTAMP
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
                ownerCountryCode: row.owner_country_code, eventType: row.onchat_meeting_id ? 'onchat' : row.event_type,
                onchatJoinUrl: row.onchat_join_url, zoomEventId: row.zoom_event_id, validatedCount: parseInt(val[0].count),
                ticketTypes: tt.map(t => ({ id: t.id, type: t.type_name, price: parseFloat(t.price), quantity: t.quantity_total, sold: t.quantity_sold }))
            };
        }));
    } catch (e) { return []; }
}

export async function getEventById(eventId: string): Promise<Event | undefined> {
    try {
        const {rows} = await db.query(`SELECT e.*, m.join_url AS onchat_join_url, u.full_name as "organizerName" FROM events e JOIN users u ON e.owner_user_id = u.id LEFT JOIN meetings m ON m.id = e.onchat_meeting_id WHERE e.id = $1::int`, [eventId]);
        if (rows.length === 0) return undefined;
        const e = rows[0];
        const {rows: tt} = await db.query('SELECT * FROM event_ticket_types WHERE event_id = $1::int', [eventId]);
        const {rows: val} = await db.query('SELECT COUNT(*) as count FROM tickets WHERE event_id = $1::int AND status = $2', [eventId, 'used']);
        return {
            id: e.id.toString(), name: e.name, description: e.description,
            date: new Date(e.event_date).toISOString(), time: e.event_time,
            location: e.location, imageUrl: e.image_url, currency: e.currency,
            organizerName: e.organizerName, ownerUserId: e.owner_user_id,
            ownerCountryCode: e.owner_country_code, eventType: e.onchat_meeting_id ? 'onchat' : e.event_type,
            onchatJoinUrl: e.onchat_join_url, zoomEventId: e.zoom_event_id, validatedCount: parseInt(val[0].count),
            ticketTypes: tt.map(t => ({ id: t.id, type: t.type_name, price: parseFloat(t.price), quantity: t.quantity_total, sold: t.quantity_sold }))
        };
    } catch (e) { return undefined; }
}

export async function getEventsForOrganizer(userId: number): Promise<Event[]> {
    try {
        const {rows} = await db.query(`SELECT e.*, m.join_url AS onchat_join_url, u.full_name as "organizerName" FROM events e JOIN users u ON e.owner_user_id = u.id LEFT JOIN meetings m ON m.id = e.onchat_meeting_id WHERE e.owner_user_id = $1::int`, [userId]);
        return await Promise.all(rows.map(async (row) => {
            const {rows: tt} = await db.query('SELECT * FROM event_ticket_types WHERE event_id = $1::int', [row.id]);
            const {rows: val} = await db.query('SELECT COUNT(*) as count FROM tickets WHERE event_id = $1::int AND status = $2', [row.id, 'used']);
            return {
                id: row.id.toString(), name: row.name, description: row.description,
                date: new Date(row.event_date).toISOString(), time: row.event_time,
                location: row.location, imageUrl: row.image_url, currency: row.currency,
                organizerName: row.organizerName, ownerUserId: row.owner_user_id,
                ownerCountryCode: row.owner_country_code, eventType: row.onchat_meeting_id ? 'onchat' : row.event_type,
                onchatJoinUrl: row.onchat_join_url, zoomEventId: row.zoom_event_id, validatedCount: parseInt(val[0].count),
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
        if (t.status !== 'valid') return { success: false, message: 'Billet déjà utilisé ou invalide.' };
        const updated = await db.query("UPDATE tickets SET status = 'used', validation_time = NOW() WHERE id = $1 AND status = 'valid' RETURNING id", [t.id]);
        if (!updated.rows.length) return { success: false, message: 'Billet déjà validé.' };
        return { success: true, message: "Billet validé.", ticket: { ownerName: t.owner_name, ticketType: t.ticket_type } };
    } catch (e) { return { success: false, message: 'Erreur.' }; }
}

export async function deleteEvent(eventId: string, userId: number): Promise<{ success: boolean; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user || Number(user.id) !== Number(userId)) return { success: false, error: 'Accès refusé.' };
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const owned = await connection.query('SELECT id, onchat_meeting_id FROM events WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [eventId, user.id]);
        if (!owned.rows[0]) throw new Error('Événement inaccessible.');
        const sold = await connection.query('SELECT 1 FROM tickets WHERE event_id = $1 LIMIT 1', [eventId]);
        if (sold.rows.length) throw new Error('Des billets ont déjà été émis. La suppression exige un traitement explicite des remboursements.');
        if (owned.rows[0].onchat_meeting_id) {
            await connection.query("UPDATE meetings SET status = 'ended' WHERE id = $1", [owned.rows[0].onchat_meeting_id]);
        }

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
  eventType?: 'live' | 'onchat' | 'zoom';
  tickets: {
    id: string;
    ticketCode: string;
    ticketType: string;
    status: 'valid' | 'used' | 'invalid' | 'expired';
    ownerName: string;
    zoomJoinUrl?: string | null;
    onchatJoinUrl?: string | null;
  }[];
}

export async function getTicketsForUser(userId: number): Promise<EventTicket[]> {
    const user = await getAuthenticatedUser();
    if (!user || Number(user.id) !== Number(userId)) return [];
    try {
        const {rows} = await db.query(`
            SELECT
                t.id as ticket_id, t.ticket_code, t.status, t.zoom_join_url,
                tt.type_name as ticket_type,
                e.id as event_id, e.name as event_name, e.event_date, e.event_time, e.location, e.image_url, e.event_type, e.onchat_meeting_id, m.join_url AS onchat_join_url
            FROM tickets t
            JOIN event_ticket_types tt ON t.ticket_type_id = tt.id
            JOIN events e ON t.event_id = e.id
            LEFT JOIN meetings m ON m.id = e.onchat_meeting_id
            WHERE t.user_id = $1::int
            ORDER BY e.event_date DESC`, [userId]);
        const grouped: Record<string, EventTicket> = {};
        for (const t of rows) {
            const id = t.event_id.toString();
            if (!grouped[id]) {
                grouped[id] = { eventId: id, eventName: t.event_name, date: t.event_date, time: t.event_time, location: t.location, imageUrl: t.image_url, eventType: t.onchat_meeting_id ? 'onchat' : t.event_type, tickets: [] };
            }
            grouped[id].tickets.push({ id: t.ticket_id.toString(), ticketCode: t.ticket_code, ticketType: t.ticket_type, status: t.status, ownerName: '', zoomJoinUrl: t.zoom_join_url, onchatJoinUrl: t.onchat_join_url ? `${t.onchat_join_url}?ticket=${encodeURIComponent(t.ticket_code)}` : null });
        }
        return Object.values(grouped);
    } catch(e) { return []; }
}
