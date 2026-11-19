'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContactsService, ContactError, MAX_ATTEMPTS, LEASE_MS } = require('../src/lib/main-site/contacts');
const NOW = new Date('2026-11-18T20:00:00Z');
const clone = value => structuredClone(value);
class MemoryDatabase {
    constructor() { this.contacts = []; this.replies = []; this.queries = []; this.failSent = false; }
    async getConnection() { return { query: this.query.bind(this), release() {} }; }
    async query(sql, values = []) {
        this.queries.push({ sql, values: clone(values) });
        const query = sql.replace(/\s+/g, ' ').trim();
        const rows = values => ({ rows: clone(values) });
        if (['BEGIN','COMMIT','ROLLBACK'].includes(query)) return rows([]);
        if (query.startsWith('INSERT INTO main_submission_contacts')) {
            let row = this.contacts.find(row => row.ref === values[0]);
            if (!row) { row = { id: String(this.contacts.length + 1), ref: values[0], kind: values[1], email: values[2], status: 'received', created_at: values[3], updated_at: values[3] }; this.contacts.push(row); }
            return rows([row]);
        }
        if (query.startsWith('UPDATE main_submission_contacts SET status=')) {
            const row = this.contacts.find(row => row.id === values[0]); if (!row) return rows([]);
            Object.assign(row, { status: values[1], updated_at: values[2] }); return rows([row]);
        }
        if (query.startsWith('SELECT id,ref,email FROM main_submission_contacts WHERE')) return rows(this.contacts.filter(row => row.id === values[0]));
        if (query.startsWith('INSERT INTO main_submission_replies')) {
            let row = values[6] && this.replies.find(row => row.contact_id === values[0] && row.idempotency_key === values[6]);
            if (!row) {
                row = { id: String(this.replies.length + 1), contact_id: values[0], subject: values[1], body_html: values[2], body_text: values[3], status: 'queued', send_at: values[4], next_attempt_at: values[4], created_by: values[5], idempotency_key: values[6], created_at: values[7], updated_at: values[7], attempts: 0, sent_at: null };
                this.replies.push(row);
            }
            return rows([row]);
        }
        if (query.startsWith("UPDATE main_submission_replies SET status='failed',last_error='LEASE_ATTEMPTS_EXHAUSTED'")) {
            this.replies.filter(row => row.status === 'sending' && row.lease_expires_at <= values[0] && row.attempts >= values[1]).forEach(row => Object.assign(row, { status: 'failed', last_error: 'LEASE_ATTEMPTS_EXHAUSTED', lease_token: null, lease_expires_at: null }));
            return rows([]);
        }
        if (query.startsWith('SELECT id FROM main_submission_replies')) {
            assert.match(query, /FOR UPDATE SKIP LOCKED$/);
            const row = this.replies.find(row => row.attempts < values[1] && ((row.status === 'queued' && row.send_at <= values[0] && row.next_attempt_at <= values[0]) || (row.status === 'sending' && row.lease_expires_at <= values[0])));
            return rows(row ? [{ id: row.id }] : []);
        }
        if (query.startsWith("UPDATE main_submission_replies SET status='sending'")) {
            const row = this.replies.find(row => row.id === String(values[0]));
            Object.assign(row, { status: 'sending', attempts: row.attempts + 1, lease_token: values[1], lease_expires_at: values[2], updated_at: values[3] }); return rows([row]);
        }
        if (query.startsWith('SELECT r.*,c.email,c.ref') || query.startsWith('SELECT r.*,c.ref,c.email FROM main_submission_replies r JOIN main_submission_contacts c ON c.id=r.contact_id WHERE r.id=')) {
            const row = this.replies.find(row => row.id === String(values[0]));
            if (!row || (values.length > 1 && (row.lease_token !== values[1] || row.status !== 'sending' || row.lease_expires_at <= values[2]))) return rows([]);
            const c = this.contacts.find(c => c.id === row.contact_id); return rows([{ ...row, ref: c.ref, email: c.email }]);
        }
        if (query.startsWith("UPDATE main_submission_replies SET status='cancelled'")) {
            const row = this.replies.find(row => row.id === values[0]); Object.assign(row, { status: 'cancelled', updated_at: values[1] }); return rows([row]);
        }
        if (query.startsWith('UPDATE main_submission_replies SET status=$3')) {
            const row = this.replies.find(row => row.id === String(values[0]) && row.lease_token === values[1] && row.status === 'sending');
            assert.match(query, /lease_token=\$2 AND status='sending'/);
            if (row) Object.assign(row, { status: values[2], next_attempt_at: values[3], updated_at: values[4], last_error: 'SMTP_SUBMISSION_UNCONFIRMED', lease_token: null, lease_expires_at: null }); return rows([]);
        }
        if (query.startsWith("UPDATE main_submission_replies SET status='sent'")) {
            if (this.failSent) throw Error('database acknowledgement failed');
            const row = this.replies.find(row => row.id === String(values[0]) && row.lease_token === values[1] && row.status === 'sending');
            assert.match(query, /lease_token=\$2 AND status='sending'/);
            if (row) Object.assign(row, { status: 'sent', sent_at: values[2], last_error: null, lease_token: null, lease_expires_at: null }); return rows([]);
        }
        if (query.startsWith('SELECT COUNT(*) AS total FROM main_submission_contacts')) return rows([{ total: this.contacts.length }]);
        if (query.startsWith('SELECT id,ref,kind,email,status,created_at,updated_at FROM main_submission_contacts')) return rows(this.contacts);
        if (query.startsWith('SELECT COUNT(*) AS total FROM main_submission_replies')) return rows([{ total: this.replies.length }]);
        if (query.startsWith('SELECT r.*,c.ref,c.email FROM main_submission_replies')) return rows(this.replies.map(row => ({ ...row, ...Object.fromEntries(Object.entries(this.contacts.find(c => c.id === row.contact_id)).filter(([key]) => ['ref','email'].includes(key))) })));
        throw Error('Unexpected SQL: ' + query);
    }
}
async function fixture(sendMail = async payload => ({ accepted: [payload.to] })) {
    const db = new MemoryDatabase(); let time = new Date(NOW); const sent = [];
    const service = createContactsService({ db, sendMail: async payload => { sent.push(payload); return sendMail(payload); }, now: () => time });
    const contact = await service.record({ ref: 'CP-261118-TEST01', kind: 'careers', email: ' Candidate@Example.invalid ', fullProfile: 'never copied', documents: ['never copied'] });
    return { db, service, contact, sent, advance(ms) { time = new Date(time.getTime() + ms); } };
}
test('record is minimal, normalizes email, and preserves recipient and review status on duplicate references', async () => {
    const f = await fixture();
    assert.equal(f.contact.email, 'candidate@example.invalid');
    assert.deepEqual(Object.keys(f.contact).sort(), ['createdAt','email','id','kind','ref','status','updatedAt']);
    await f.service.setStatus(f.contact.id, 'reviewing');
    const duplicate = await f.service.record({ ref: f.contact.ref, kind: 'project', email: 'other@example.invalid' });
    assert.equal(duplicate.status, 'reviewing'); assert.equal(duplicate.kind, 'careers'); assert.equal(duplicate.email, f.contact.email); assert.equal(f.db.contacts.length, 1);
    assert.doesNotMatch(JSON.stringify(f.db.queries), /fullProfile|never copied|newsletter_subscribers/);
    await assert.rejects(f.service.record({ ref: 'CP-123\nBcc: bad', kind: 'careers', email: 'a@example.invalid' }), ContactError);
    await assert.rejects(f.service.record({ ref: 'PR-good', kind: 'project', email: 'bad\n@example.invalid' }), ContactError);
});
test('list and review operations validate inputs and use bounded parameterized filters', async () => {
    const f = await fixture();
    const result = await f.service.list({ status: 'received', kind: 'careers', q: "%' OR 1=1 --", limit: '5', offset: '0' });
    assert.equal(result.total, 1); assert.equal(result.contacts[0].id, f.contact.id);
    const query = f.db.queries.find(row => row.sql.startsWith('SELECT id,ref,kind'));
    assert.doesNotMatch(query.sql, /OR 1=1/); assert.match(query.sql, /LIMIT \$\d+ OFFSET \$\d+/); assert.match(query.values[2], /OR 1=1/);
    for (const args of [{ limit: 101 }, { offset: -1 }, { status: 'anything' }, { q: 'x'.repeat(201) }]) await assert.rejects(f.service.list(args), ContactError);
    await assert.rejects(f.service.setStatus(f.contact.id, 'sent'), ContactError);
    assert.equal((await f.service.setStatus(f.contact.id, 'shortlisted')).status, 'shortlisted');
});
test('reply scheduling sanitizes content, defaults to immediate, and deduplicates an explicit request key', async () => {
    const f = await fixture();
    const input = { contactId: f.contact.id, subject: 'Votre candidature', bodyHtml: '<p>Merci <strong>à vous</strong><script>bad()</script><img src="https://example.invalid/photo.png" onerror="bad()"></p>', idempotencyKey: 'request-key-123456' };
    const scheduled = await f.service.scheduleReply(input, { id: 'editor-1' });
    assert.equal(scheduled.status, 'queued'); assert.equal(scheduled.sendAt, NOW.toISOString()); assert.equal(scheduled.email, f.contact.email); assert.doesNotMatch(scheduled.bodyHtml, /script|onerror|bad\(/);
    assert.match(scheduled.bodyHtml, /<strong>à vous<\/strong>/);
    assert.equal((await f.service.scheduleReply(input, { id: 'editor-1' })).id, scheduled.id); assert.equal(f.db.replies.length, 1);
    assert.equal(f.sent.length, 0);
    await assert.rejects(f.service.scheduleReply({ ...input, subject: 'subject\r\nBcc: bad' }, 'editor'), ContactError);
    await assert.rejects(f.service.scheduleReply({ ...input, sendAt: '2026-11-19T12:00' }, 'editor'), ContactError);
    await assert.rejects(f.service.scheduleReply({ ...input, bodyHtml: '<script>only bad()</script>' }, 'editor'), ContactError);
});
test('future replies wait, queued cancellation is idempotent, and sending replies cannot be cancelled', async () => {
    const f = await fixture();
    const future = await f.service.scheduleReply({ contactId: f.contact.id, subject: 'Future', bodyHtml: '<p>Hello</p>', sendAt: '2026-11-19T20:00:00Z' }, 'editor');
    assert.equal((await f.service.dispatchDueReplies()).processed, 0);
    assert.equal((await f.service.cancelReply(future.id)).status, 'cancelled');
    assert.equal((await f.service.cancelReply(future.id)).status, 'cancelled');
    const sending = await f.service.scheduleReply({ contactId: f.contact.id, subject: 'Now', bodyHtml: '<p>Hello</p>' }, 'editor');
    f.db.replies.find(row => row.id === sending.id).status = 'sending';
    await assert.rejects(f.service.cancelReply(sending.id), error => error.status === 409);
    assert.equal(f.sent.length, 0);
});
test('only accepted SMTP receipts finish replies, with durable lease token and stable message ID', async () => {
    const f = await fixture();
    const scheduled = await f.service.scheduleReply({ contactId: f.contact.id, subject: 'Hello', bodyHtml: '<p>Welcome <b>back</b>.</p>' }, 'editor');
    const result = await f.service.dispatchDueReplies();
    assert.deepEqual(result, { processed: 1, sent: 1, retried: 0, failed: 0 }); assert.equal(f.sent.length, 1);
    assert.equal(f.db.replies[0].status, 'sent'); assert.equal(f.db.replies[0].attempts, 1); assert.equal(f.db.replies[0].lease_token, null);
    assert.equal(f.sent[0].messageId, `<main-reply-${scheduled.id}@cashpay-all.com>`); assert.equal(f.sent[0].to, f.contact.email); assert.equal(f.sent[0].text, 'Welcome back.');
    assert.equal((await f.service.dispatchDueReplies()).processed, 0);
    assert.ok(f.db.queries.some(row => row.sql.includes('FOR UPDATE SKIP LOCKED')));
});
test('unconfirmed SMTP submissions back off and stop after the bounded number of attempts without leaking errors', async () => {
    const f = await fixture(async () => { throw Error('secret-password candidate@example.invalid'); });
    await f.service.scheduleReply({ contactId: f.contact.id, subject: 'Hello', bodyHtml: '<p>Hello</p>' }, 'editor');
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const result = await f.service.dispatchDueReplies();
        assert.equal(result.processed, 1); assert.equal(result[attempt === MAX_ATTEMPTS ? 'failed' : 'retried'], 1);
        if (attempt < MAX_ATTEMPTS) assert.equal((await f.service.dispatchDueReplies()).processed, 0);
        f.advance(3600001);
    }
    assert.equal(f.sent.length, MAX_ATTEMPTS); assert.equal(f.db.replies[0].status, 'failed'); assert.equal((await f.service.dispatchDueReplies()).processed, 0);
    assert.equal(f.db.replies[0].last_error, 'SMTP_SUBMISSION_UNCONFIRMED'); assert.doesNotMatch(JSON.stringify(f.db.queries), /secret-password/);
});
test('a mail result without the intended accepted recipient is retried', async () => {
    for (const receipt of [{ accepted: [] }, { accepted: ['other@example.invalid'] }, { messageId: 'smtp-id' }]) {
        const f = await fixture(async () => receipt);
        await f.service.scheduleReply({ contactId: f.contact.id, subject: 'Hello', bodyHtml: '<p>Hello</p>' }, 'editor');
        assert.equal((await f.service.dispatchDueReplies()).retried, 1); assert.equal(f.db.replies[0].status, 'queued');
    }
});
test('expired leases recover and SQL acknowledgement failures leave the accepted-mail lease visible', async () => {
    const f = await fixture();
    await f.service.scheduleReply({ contactId: f.contact.id, subject: 'Hello', bodyHtml: '<p>Hello</p>' }, 'editor');
    f.db.failSent = true;
    await assert.rejects(f.service.dispatchDueReplies(), /database acknowledgement failed/);
    assert.equal(f.sent.length, 1); assert.equal(f.db.replies[0].status, 'sending'); assert.equal(f.db.replies[0].attempts, 1);
    assert.equal((await f.service.dispatchDueReplies()).processed, 0);
    f.advance(LEASE_MS + 1); f.db.failSent = false;
    assert.equal((await f.service.dispatchDueReplies()).sent, 1); assert.equal(f.sent.length, 2);
    assert.equal(f.sent[0].messageId, f.sent[1].messageId);
});
test('an expired final lease terminates and lists expose safe camelCase metadata', async () => {
    const f = await fixture();
    await f.service.scheduleReply({ contactId: f.contact.id, subject: 'Hello', bodyHtml: '<p>Hello</p>' }, 'editor');
    Object.assign(f.db.replies[0], { status: 'sending', attempts: MAX_ATTEMPTS, lease_expires_at: new Date(NOW.getTime() - 1), lease_token: 'old' });
    assert.equal((await f.service.dispatchDueReplies()).processed, 0); assert.equal(f.db.replies[0].status, 'failed');
    const listed = await f.service.listReplies({ limit: 10 });
    assert.equal(listed.total, 1); assert.equal(listed.replies[0].contactId, f.contact.id); assert.equal(listed.replies[0].lastError, 'LEASE_ATTEMPTS_EXHAUSTED');
    assert.equal(listed.replies[0].lease_token, undefined);
});

 test('short dispatch budgets do not claim durable work and invalid budgets reject', async () => {
    const f = await fixture();
    await f.service.scheduleReply({ contactId: f.contact.id, subject: 'Hello', bodyHtml: '<p>Hello</p>' }, 'editor');
    assert.equal((await f.service.dispatchDueReplies({ budgetMs: 10000 })).processed, 0);
    assert.equal(f.db.replies[0].attempts, 0);
    await assert.rejects(f.service.dispatchDueReplies({ budgetMs: 45001 }), ContactError);
});
