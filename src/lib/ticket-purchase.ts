import crypto from 'crypto';
import { db } from '@/lib/db';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { paymentQuote } from '@/lib/payment-quote';
import type { PoolClient } from 'pg';
import type { User } from '@/lib/types';
async function load(connection: PoolClient, eventId: string, ticketTypeId: number, quantity: number, lock = false) {
    if (!/^\d+$/.test(eventId) || !Number.isInteger(ticketTypeId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('Événement, billet ou quantité invalide (1 à 10).');
    const { rows } = await connection.query(`SELECT tt.*, e.currency, e.owner_user_id, e.status AS event_status, e.name, e.event_type, e.onchat_meeting_id
      FROM event_ticket_types tt JOIN events e ON e.id = tt.event_id WHERE tt.id = $1 AND tt.event_id = $2 ${lock ? 'FOR UPDATE OF tt, e' : ''}`, [ticketTypeId, eventId]);
    const ticket = rows[0];
    if (!ticket || ticket.event_status !== 'active') throw new Error('Billet ou événement indisponible.');
    if (ticket.event_type === 'zoom') throw new Error('La vente de nouveaux billets Zoom est fermée. Choisissez un événement local ou OnChat Meet.');
    if (!Number.isFinite(Number(ticket.price)) || Number(ticket.price) < 0) throw new Error('Tarif invalide.');
    if (Number(ticket.quantity_sold) + quantity > Number(ticket.quantity_total)) throw new Error('Billets épuisés.');
    return ticket;
}
export async function quoteEventTicket(user: User, eventId: string, ticketTypeId: number, quantity: number, currency: string) {
    const connection = await db.getConnection();
    try { const ticket = await load(connection, eventId, ticketTypeId, quantity); return await paymentQuote(connection, user, Number(ticket.price) * quantity, ticket.currency, currency || ticket.currency, 'TICKET_BUY'); }
    finally { connection.release(); }
}
export async function buyEventTickets(user: User, eventId: string, ticketTypeId: number, quantity: number, currency: string, pin?: string, maxDebit?: number) {
    // PIN validation is performed server-side before taking database transaction locks.
    const verified = pin ? await verifyCurrentUserPin(pin) : { success: false };
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const ticket = await load(connection, eventId, ticketTypeId, quantity, true);
        if (Number(ticket.owner_user_id) === Number(user.id)) throw new Error('L’organisateur ne peut pas acheter ses propres billets.');
        const { rows: wallets } = await connection.query('SELECT user_id FROM wallets WHERE user_id = ANY($1::int[]) ORDER BY user_id FOR UPDATE', [[user.id, Number(ticket.owner_user_id)]]);
        const quote = await paymentQuote(connection, user, Number(ticket.price) * quantity, ticket.currency, currency || ticket.currency, 'TICKET_BUY');
        let transactionId: number | null = null;
        if (quote.totalDebit > 0) {
            if (!verified.success) throw new Error('PIN incorrect ou manquant. Aucun débit effectué.');
            if (!Number.isFinite(maxDebit) || Number(maxDebit) < quote.totalDebit) throw new Error('Confirmez à nouveau le montant total et les frais.');
            if (!quote.sufficientBalance) throw new Error(`Solde insuffisant : requis ${quote.totalDebit} ${quote.currency}, disponible ${quote.balance} ${quote.currency}.`);
            if (wallets.length !== 2) throw new Error('Portefeuille participant ou organisateur introuvable.');
            const tx = await createTransaction({ user, typeCode: 'TICKET_BUY', amount: Number(ticket.price) * quantity,
                currency: ticket.currency, sourceCurrency: quote.currency, receiver_id: Number(ticket.owner_user_id),
                description: `Billets — ${ticket.name}`, metadata: { eventId, ticketTypeId, quantity }, connection });
            if (!tx.success) throw new Error(tx.error || 'Paiement refusé.');
            const actualDebit = quote.balance - Number(tx.senderNewBalance);
            if (!Number.isFinite(actualDebit) || actualDebit > Number(maxDebit) + 0.00000001) throw new Error('Les frais ont changé. Aucun débit confirmé ; actualisez le tarif.');
            transactionId = tx.transactionId || null;
        }
        const tickets = [];
        for (let i = 0; i < quantity; i++) {
            const ticketCode = `OC-${crypto.randomUUID()}`;
            const { rows } = await connection.query(`INSERT INTO tickets (event_id, ticket_type_id, user_id, ticket_code, status, purchase_transaction_id)
              VALUES ($1, $2, $3, $4, 'valid', $5) RETURNING id`, [eventId, ticketTypeId, user.id, ticketCode, transactionId]);
            tickets.push({ id: String(rows[0].id), ownerName: user.full_name, ticketType: ticket.type_name, ticketCode, status: 'valid' });
        }
        await connection.query('UPDATE event_ticket_types SET quantity_sold = quantity_sold + $1 WHERE id = $2', [quantity, ticketTypeId]);
        if (ticket.onchat_meeting_id) await connection.query("SELECT pg_notify('onchat_meetings', json_build_object('meetCode', meeting_provider_id)::text) FROM meetings WHERE id = $1", [ticket.onchat_meeting_id]);
        await connection.query('COMMIT');
        return { success: true as const, ticket: tickets[0], tickets, transactionId, amountCharged: quote.totalDebit, currency: quote.currency };
    } catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
}
