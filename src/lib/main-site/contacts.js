'use strict';
const crypto = require('node:crypto');
const { sanitizeArticleHtml, plainText } = require('./articles');
const { sendAccepted } = require('./delivery');

const CONTACT_STATUSES = new Set(['received', 'reviewing', 'shortlisted', 'accepted', 'rejected']);
const REPLY_STATUSES = new Set(['queued', 'sending', 'sent', 'failed', 'cancelled']);
const MAX_ATTEMPTS = 5;
const LEASE_MS = 120000;
const BACKOFF_MS = [60000, 300000, 900000, 3600000];
class ContactError extends Error {
    constructor(status, code, message) { super(message || code); this.name = 'ContactError'; this.status = status; this.code = code; }
}
const invalid = message => { throw new ContactError(422, 'invalid_contact', message); };
const iso = value => value ? new Date(value).toISOString() : null;
const identifier = value => {
    if (!/^[1-9]\d{0,18}$/.test(String(value))) throw new ContactError(404, 'contact_not_found', 'Contact ou réponse introuvable.');
    return String(value);
};
function emailAddress(value) {
    if (typeof value !== 'string') invalid('Une adresse e-mail valide est requise.');
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email)) invalid('Une adresse e-mail valide est requise.');
    return email;
}
function contact(row) {
    return { id: String(row.id), ref: row.ref, kind: row.kind, email: row.email, status: row.status, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function reply(row) {
    return { id: String(row.id), contactId: String(row.contact_id), ref: row.ref, email: row.email, subject: row.subject, bodyHtml: row.body_html, status: row.status, sendAt: iso(row.send_at), sentAt: iso(row.sent_at), attempts: Number(row.attempts), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), lastError: row.last_error || null };
}
function paging(params = {}, replies = false) {
    const get = name => typeof params?.get === 'function' ? params.get(name) : params?.[name];
    const number = (name, fallback, max) => {
        const value = get(name);
        if (value === undefined || value === null || value === '') return fallback;
        if (!/^\d+$/.test(String(value)) || Number(value) > max || (name === 'limit' && Number(value) < 1)) invalid('Pagination invalide.');
        return Number(value);
    };
    const result = { limit: number('limit', 20, 100), offset: number('offset', 0, 1000000), status: get('status'), kind: get('kind'), q: get('q'), contactId: get('contactId') };
    if (result.status && !(replies ? REPLY_STATUSES : CONTACT_STATUSES).has(result.status)) invalid('Statut invalide.');
    if (result.kind && !['careers', 'project'].includes(result.kind)) invalid('Type de contact invalide.');
    if (result.q && (typeof result.q !== 'string' || result.q.length > 200)) invalid('Recherche invalide.');
    if (result.contactId) result.contactId = identifier(result.contactId);
    return result;
}
async function transaction(db, work) {
    const client = await db.getConnection();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
}
function createContactsService({ db, sendMail, now = () => new Date(), maxDispatchMs = 45000 } = {}) {
    if (!db?.query || !db?.getConnection || typeof sendMail !== 'function') throw new TypeError('Contacts database and mail sender are required.');
    if (!Number.isInteger(maxDispatchMs) || maxDispatchMs < 1000 || maxDispatchMs > 45000) throw new TypeError('Invalid dispatch time budget.');
    const at = () => new Date(now());
    async function record(input = {}) {
        if (typeof input.ref !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/.test(input.ref)) invalid('Référence invalide.');
        if (!['careers', 'project'].includes(input.kind)) invalid('Type de contact invalide.');
        const email = emailAddress(input.email);
        // The reference is immutable: repeat submissions cannot change the recipient.
        const result = await db.query(`INSERT INTO main_submission_contacts (ref,kind,email,status,created_at,updated_at)
            VALUES ($1,$2,$3,'received',$4,$4) ON CONFLICT (ref) DO UPDATE SET ref=EXCLUDED.ref RETURNING *`, [input.ref, input.kind, email, at()]);
        return contact(result.rows[0]);
    }
    async function list(params) {
        const filter = paging(params), values = [], clauses = [];
        const bind = value => { values.push(value); return '$' + values.length; };
        if (filter.kind) clauses.push('kind=' + bind(filter.kind));
        if (filter.status) clauses.push('status=' + bind(filter.status));
        if (filter.q) { const token = bind('%' + filter.q.trim().replace(/[\\%_]/g, '\\$&') + '%'); clauses.push(`(email ILIKE ${token} ESCAPE '\\' OR ref ILIKE ${token} ESCAPE '\\')`); }
        const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
        const countValues = values.slice(); const limit = bind(filter.limit), offset = bind(filter.offset);
        const [page, count] = await Promise.all([
            db.query('SELECT id,ref,kind,email,status,created_at,updated_at FROM main_submission_contacts' + where + ' ORDER BY created_at DESC,id DESC LIMIT ' + limit + ' OFFSET ' + offset, values),
            db.query('SELECT COUNT(*) AS total FROM main_submission_contacts' + where, countValues)
        ]);
        return { contacts: page.rows.map(contact), total: Number(count.rows[0]?.total || 0) };
    }
    async function setStatus(id, status) {
        id = identifier(id); if (!CONTACT_STATUSES.has(status)) invalid('Statut invalide.');
        const result = await db.query('UPDATE main_submission_contacts SET status=$2,updated_at=$3 WHERE id=$1 RETURNING *', [id, status, at()]);
        if (!result.rows[0]) throw new ContactError(404, 'contact_not_found', 'Contact introuvable.');
        return contact(result.rows[0]);
    }
    async function listReplies(params) {
        const filter = paging(params, true), values = [], clauses = [];
        const bind = value => { values.push(value); return '$' + values.length; };
        if (filter.status) clauses.push('r.status=' + bind(filter.status));
        if (filter.contactId) clauses.push('r.contact_id=' + bind(filter.contactId));
        if (filter.kind) clauses.push('c.kind=' + bind(filter.kind));
        if (filter.q) { const token = bind('%' + filter.q.trim().replace(/[\\%_]/g, '\\$&') + '%'); clauses.push(`(c.email ILIKE ${token} ESCAPE '\\' OR c.ref ILIKE ${token} ESCAPE '\\')`); }
        const join = ' FROM main_submission_replies r JOIN main_submission_contacts c ON c.id=r.contact_id';
        const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
        const countValues = values.slice(); const limit = bind(filter.limit), offset = bind(filter.offset);
        const [page, count] = await Promise.all([
            db.query('SELECT r.*,c.ref,c.email' + join + where + ' ORDER BY r.created_at DESC,r.id DESC LIMIT ' + limit + ' OFFSET ' + offset, values),
            db.query('SELECT COUNT(*) AS total' + join + where, countValues)
        ]);
        return { replies: page.rows.map(reply), total: Number(count.rows[0]?.total || 0) };
    }
    async function scheduleReply(input = {}, actor) {
        const id = identifier(input.contactId);
        if (typeof input.subject !== 'string' || !input.subject.trim() || input.subject.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(input.subject)) invalid('Objet invalide.');
        const subject = input.subject.trim();
        let bodyHtml;
        try { bodyHtml = sanitizeArticleHtml(input.bodyHtml); } catch (_) { invalid('Le contenu de la réponse est invalide.'); }
        const bodyText = plainText(bodyHtml);
        if (!bodyText && !/<(?:img|iframe)\b/.test(bodyHtml)) invalid('Le contenu de la réponse est requis.');
        const createdAt = at();
        let sendAt = createdAt;
        if (input.sendAt !== undefined && input.sendAt !== null && input.sendAt !== '') {
            if (typeof input.sendAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.sendAt)) invalid('Une date ISO avec fuseau horaire est requise.');
            sendAt = new Date(input.sendAt); if (!Number.isFinite(sendAt.getTime())) invalid('Date invalide.');
        }
        let idempotencyKey = null;
        if (input.idempotencyKey !== undefined && input.idempotencyKey !== null) {
            if (typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(input.idempotencyKey)) invalid('Clé de requête invalide.');
            idempotencyKey = input.idempotencyKey;
        }
        const actorId = String(actor?.id || actor || 'system');
        if (actorId.length > 100 || /[\r\n\u0000]/.test(actorId)) invalid('Utilisateur invalide.');
        return transaction(db, async client => {
            const selected = (await client.query('SELECT id,ref,email FROM main_submission_contacts WHERE id=$1 FOR SHARE', [id])).rows[0];
            if (!selected) throw new ContactError(404, 'contact_not_found', 'Contact introuvable.');
            const result = await client.query(`INSERT INTO main_submission_replies (contact_id,subject,body_html,body_text,status,send_at,next_attempt_at,created_by,idempotency_key,created_at,updated_at)
                VALUES ($1,$2,$3,$4,'queued',$5,$5,$6,$7,$8,$8)
                ON CONFLICT (contact_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *`, [id, subject, bodyHtml, bodyText, sendAt, actorId, idempotencyKey, createdAt]);
            return reply({ ...result.rows[0], ref: selected.ref, email: selected.email });
        });
    }
    async function cancelReply(id) {
        id = identifier(id);
        return transaction(db, async client => {
            const row = (await client.query('SELECT r.*,c.ref,c.email FROM main_submission_replies r JOIN main_submission_contacts c ON c.id=r.contact_id WHERE r.id=$1 FOR UPDATE OF r', [id])).rows[0];
            if (!row) throw new ContactError(404, 'reply_not_found', 'Réponse introuvable.');
            if (row.status === 'cancelled') return reply(row);
            if (!['queued', 'failed'].includes(row.status)) throw new ContactError(409, 'reply_already_sending', 'Cette réponse ne peut plus être annulée.');
            const updated = await client.query("UPDATE main_submission_replies SET status='cancelled',updated_at=$2 WHERE id=$1 RETURNING *", [id, at()]);
            return reply({ ...updated.rows[0], ref: row.ref, email: row.email });
        });
    }
    async function claimOne() {
        return transaction(db, async client => {
            const date = at();
            await client.query(`UPDATE main_submission_replies SET status='failed',last_error='LEASE_ATTEMPTS_EXHAUSTED',lease_token=NULL,lease_expires_at=NULL,updated_at=$1
                WHERE status='sending' AND lease_expires_at<=$1 AND attempts>=$2`, [date, MAX_ATTEMPTS]);
            const selected = (await client.query(`SELECT id FROM main_submission_replies WHERE attempts<$2 AND
                ((status='queued' AND send_at<=$1 AND next_attempt_at<=$1) OR (status='sending' AND lease_expires_at<=$1))
                ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`, [date, MAX_ATTEMPTS])).rows[0];
            if (!selected) return null;
            const token = crypto.randomBytes(24).toString('base64url');
            return (await client.query(`UPDATE main_submission_replies SET status='sending',attempts=attempts+1,lease_token=$2,lease_expires_at=$3,updated_at=$4
                WHERE id=$1 RETURNING id,attempts,lease_token`, [selected.id, token, new Date(date.getTime() + LEASE_MS), date])).rows[0];
        });
    }
    async function dispatchDueReplies({ limit = 10, budgetMs = 40000 } = {}) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid('Limite de traitement invalide.');
        if (!Number.isInteger(budgetMs) || budgetMs < 0 || budgetMs > 45000) invalid('Budget de traitement invalide.');
        const stats = { processed: 0, sent: 0, retried: 0, failed: 0 };
        const deadline = Date.now() + Math.min(budgetMs, maxDispatchMs);
        for (let index = 0; index < limit && Date.now() + 15000 <= deadline; index++) {
            const lease = await claimOne(); if (!lease) break;
            const row = (await db.query(`SELECT r.*,c.email,c.ref FROM main_submission_replies r JOIN main_submission_contacts c ON c.id=r.contact_id
                WHERE r.id=$1 AND r.lease_token=$2 AND r.status='sending' AND r.lease_expires_at>$3`, [lease.id, lease.lease_token, at()])).rows[0];
            if (!row) continue;
            stats.processed++;
            // SMTP acceptance and the SQL acknowledgement are separate systems. A process
            // crash between them may cause a duplicate after the durable lease expires.
            let sendTimer;
            try {
                const clean = sanitizeArticleHtml(row.body_html);
                await Promise.race([
                    sendAccepted(sendMail, { to: row.email, subject: row.subject, html: clean, text: plainText(clean), messageId: `<main-reply-${lease.id}@cashpay-all.com>`, headers: { 'Auto-Submitted': 'auto-generated' } }),
                    new Promise((_, reject) => { sendTimer = setTimeout(() => reject(new Error('SMTP_TIMEOUT')), Math.max(1, Math.min(15000, deadline - Date.now()))); })
                ]);
            } catch (_) {
                const terminal = Number(lease.attempts) >= MAX_ATTEMPTS;
                await db.query(`UPDATE main_submission_replies SET status=$3,last_error='SMTP_SUBMISSION_UNCONFIRMED',next_attempt_at=$4,lease_token=NULL,lease_expires_at=NULL,updated_at=$5
                    WHERE id=$1 AND lease_token=$2 AND status='sending'`, [lease.id, lease.lease_token, terminal ? 'failed' : 'queued', new Date(at().getTime() + BACKOFF_MS[Math.min(Number(lease.attempts) - 1, BACKOFF_MS.length - 1)]), at()]);
                stats[terminal ? 'failed' : 'retried']++; continue;
            } finally { clearTimeout(sendTimer); }
            // Do not convert accepted mail to a normal SMTP retry if this DB write fails.
            // Its lease remains visible to operations and recovers through bounded leases.
            await db.query("UPDATE main_submission_replies SET status='sent',sent_at=$3,last_error=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=$3 WHERE id=$1 AND lease_token=$2 AND status='sending'", [lease.id, lease.lease_token, at()]);
            stats.sent++;
        }
        return stats;
    }
    return { record, list, setStatus, listReplies, scheduleReply, cancelReply, dispatchDueReplies };
}
module.exports = { createContactsService, ContactError, CONTACT_STATUSES, REPLY_STATUSES, MAX_ATTEMPTS, LEASE_MS, BACKOFF_MS };
