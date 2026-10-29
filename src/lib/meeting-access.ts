import { db } from '@/lib/db';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { countryToCode } from '@/lib/utils';
import type { User } from '@/lib/types';
import type { PoolClient } from 'pg';

export class MeetingAccessError extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
}
export function meetingPrice(value: unknown, currency: unknown) {
    const amount = Number(value ?? 0);
    const unit = String(currency || 'USD').trim().toUpperCase();
    if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3,10}$/.test(unit)) {
        throw new MeetingAccessError(400, 'INVALID_PRICE', 'Montant ou devise invalide.');
    }
    return { amount, currency: unit };
}

async function getMeeting(connection: PoolClient, code: string, lock = false) {
    const { rows } = await connection.query(`SELECT * FROM meetings WHERE meeting_provider_id = $1 ${lock ? 'FOR UPDATE' : ''}`, [code]);
    const meeting = rows[0];
    if (!meeting) throw new MeetingAccessError(404, 'MEET_NOT_FOUND', 'Réunion introuvable.');
    if (meeting.status !== 'active') throw new MeetingAccessError(410, 'MEET_ENDED', 'Cette réunion est terminée.');
    return meeting;
}

async function quote(connection: PoolClient, meeting: any, user: User, requestedCurrency?: string) {
    if (meeting.group_id && Number(meeting.host_user_id) !== Number(user.id)) {
        const membership = await connection.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = \'active\'', [meeting.group_id, user.id]);
        if (!membership.rows.length) throw new MeetingAccessError(403, 'GROUP_ACCESS_REQUIRED', 'Cette réunion est réservée aux membres du groupe.');
    }
    const price = meetingPrice(meeting.price_amount, meeting.price_currency);
    const currency = meetingPrice(0, requestedCurrency || price.currency).currency;
    const { rows: participant } = await connection.query('SELECT fee_paid FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2', [meeting.id, user.id]);
    const { rows: events } = await connection.query("SELECT id, status FROM events WHERE onchat_meeting_id = $1 LIMIT 1", [meeting.id]);
    const isHost = Number(meeting.host_user_id) === Number(user.id);
    if (events[0] && events[0].status !== 'active' && !isHost) throw new MeetingAccessError(410, 'EVENT_CLOSED', 'Cet événement est fermé.');
    const alreadyPaid = Number(participant[0]?.fee_paid || 0) > 0;
    const requiresTicket = !isHost && Boolean(events[0]);
    let debit = isHost || alreadyPaid || requiresTicket ? 0 : price.amount;
    if (debit && currency !== price.currency) {
        const { rows } = await connection.query('SELECT rate FROM exchange_rates WHERE country_code = $1 AND from_currency = $2 AND to_currency = $3', [countryToCode(user.country) || 'GBL', price.currency, currency]);
        const rate = Number(rows[0]?.rate);
        if (!Number.isFinite(rate) || rate <= 0) throw new MeetingAccessError(400, 'RATE_UNAVAILABLE', 'Taux de change indisponible pour cette devise.');
        debit *= rate;
    }
    if (!Number.isFinite(debit)) throw new MeetingAccessError(400, 'INVALID_PRICE', 'Montant converti invalide.');
    const fee = debit > 0 ? Number(await calculateTransactionFee(debit, currency, 'TR', user.country, connection)) : 0;
    if (!Number.isFinite(fee) || fee < 0) throw new MeetingAccessError(500, 'INVALID_FEE', 'Impossible de calculer les frais.');
    const { rows: wallets } = await connection.query('SELECT balances FROM wallets WHERE user_id = $1', [user.id]);
    const balances = typeof wallets[0]?.balances === 'string' ? JSON.parse(wallets[0].balances) : wallets[0]?.balances || {};
    const balance = Number(balances[currency] || 0);
    return { priceAmount: price.amount, priceCurrency: price.currency, currency, amount: debit, fee,
        totalDebit: debit + fee, balance, sufficientBalance: balance >= debit + fee,
        isHost, alreadyPaid, requiresTicket, eventId: events[0]?.id || null };
}

export async function quoteMeetingAccess(code: string, user: User, currency?: string) {
    const connection = await db.getConnection();
    try { const meeting = await getMeeting(connection, code); return { meeting, quote: await quote(connection, meeting, user, currency) }; }
    finally { connection.release(); }
}

export async function admitMeeting(code: string, user: User, body: { pin?: string; currency?: string; maxDebit?: number; consent?: boolean; ticketCode?: string }) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        // Serializes admission, tariff changes and concurrent retries for this meeting.
        const meeting = await getMeeting(connection, code, true);
        let access = await quote(connection, meeting, user, body.currency);
        let charged = false;
        if (access.requiresTicket) {
            const { rows } = await connection.query(`SELECT id FROM tickets WHERE event_id = $1 AND user_id = $2 AND ticket_code = $3 AND status IN ('valid', 'used') FOR UPDATE`, [access.eventId, user.id, String(body.ticketCode || '').trim()]);
            if (!rows[0]) throw new MeetingAccessError(403, 'TICKET_REQUIRED', 'Achetez un billet puis saisissez votre code de participation.');
            // The code belongs to this account; reconnects do not consume or charge a second ticket.
            await connection.query("UPDATE tickets SET status = 'used', validation_time = COALESCE(validation_time, NOW()) WHERE id = $1", [rows[0].id]);
        } else if (access.totalDebit > 0) {
            const { rows: lockedWallets } = await connection.query('SELECT user_id FROM wallets WHERE user_id = ANY($1::int[]) ORDER BY user_id FOR UPDATE', [[user.id, Number(meeting.host_user_id)]]);
            access = await quote(connection, meeting, user, body.currency);
            if (body.consent !== true || !Number.isFinite(body.maxDebit) || Number(body.maxDebit) < access.totalDebit) {
                throw new MeetingAccessError(409, 'PAYMENT_CONFIRMATION_REQUIRED', 'Confirmez le montant total et les frais avant de participer.');
            }
            if (!body.pin) throw new MeetingAccessError(402, 'PIN_REQUIRED', 'Votre PIN est requis pour autoriser le paiement.');
            const verification = await verifyCurrentUserPin(body.pin);
            if (!verification.success) throw new MeetingAccessError(403, 'INVALID_PIN', verification.error || 'PIN incorrect.');
            if (!access.sufficientBalance) throw new MeetingAccessError(402, 'INSUFFICIENT_BALANCE', `Solde insuffisant : ${access.balance} ${access.currency}, requis ${access.totalDebit} ${access.currency}.`);
            // Lock the wallets in a stable order to avoid deadlocks between payers/organizers.
            if (lockedWallets.length !== 2) throw new MeetingAccessError(404, 'WALLET_NOT_FOUND', 'Portefeuille participant ou organisateur introuvable.');
            const result = await createTransaction({ user, typeCode: 'TR', amount: access.priceAmount,
                currency: access.priceCurrency, sourceCurrency: access.currency, receiver_id: Number(meeting.host_user_id),
                description: `Participation OnChat — ${meeting.topic}`, metadata: { onchat: true, meetingId: meeting.id, meetCode: code }, connection });
            if (!result.success) throw new MeetingAccessError(402, 'PAYMENT_FAILED', result.error || 'Paiement refusé.');
            const actualDebit = access.balance - Number(result.senderNewBalance);
            if (!Number.isFinite(actualDebit) || actualDebit > Number(body.maxDebit) + 0.00000001) throw new MeetingAccessError(409, 'QUOTE_CHANGED', 'Le tarif ou les frais ont changé. Confirmez à nouveau le montant.');
            charged = true;
        }
        await connection.query(`INSERT INTO meeting_participants (meeting_id, user_id, is_host, joined_at, left_at, fee_paid, fee_currency, can_speak, role)
            VALUES ($1, $2, $3, NOW(), NULL, $4, $5, $3, $6)
            ON CONFLICT (meeting_id, user_id) DO UPDATE SET joined_at = NOW(), left_at = NULL,
              is_host = EXCLUDED.is_host,
              can_speak = CASE WHEN EXCLUDED.is_host THEN true ELSE meeting_participants.can_speak END,
              role = CASE WHEN EXCLUDED.is_host THEN 'host' ELSE meeting_participants.role END,
              fee_paid = CASE WHEN EXCLUDED.fee_paid > 0 THEN EXCLUDED.fee_paid ELSE meeting_participants.fee_paid END,
              fee_currency = COALESCE(EXCLUDED.fee_currency, meeting_participants.fee_currency)`,
            [meeting.id, user.id, access.isHost, charged ? access.amount : 0, charged ? access.currency : null, access.isHost ? 'host' : 'viewer']);
        await connection.query("SELECT pg_notify('onchat_meetings', $1)", [JSON.stringify({ meetCode: code })]);
        await connection.query('COMMIT');
        return { success: true, meetCode: code, joinUrl: meeting.join_url, topic: meeting.topic, type: meeting.type, isHost: access.isHost, charged, amount: charged ? access.totalDebit : 0, currency: access.currency };
    } catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
}
