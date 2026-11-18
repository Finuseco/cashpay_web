'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { format } = require('node:util');
const { createCareersHandler } = require('../src/lib/careers/handler');

const NOW = Date.parse('2026-11-17T19:00:00Z');
const ORIGIN = 'https://cashpay-all.com';
const SECRET = 'synthetic-smtp-credential';
const recipients = value => (Array.isArray(value) ? value : [value]).map(v => typeof v === 'string' ? v : v.address);
function fixture({ env = {}, limits, sendMail } = {}) {
    const messages = [], transports = [], logs = [];
    const handler = createCareersHandler({
        env: { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465', SMTP_USER: 'noreply@example.test', SMTP_PASSWORD: SECRET, CAREERS_MAIL_TO: 'info@example.test', ...env },
        limits, clock: () => NOW,
        logger: { log(...args) { logs.push(format(...args)); }, error(...args) { logs.push(format(...args)); } },
        transportFactory(options, kind) {
            const state = { options, kind, closed: false }; transports.push(state);
            return { async sendMail(message) {
                messages.push({ kind, message });
                return sendMail ? sendMail(message, kind) : { accepted: recipients(message.to) };
            }, close() { state.closed = true; } };
        }
    });
    return { handler, messages, transports, logs };
}
function form(overrides = {}, { photo = true, cv = true, docs = 0 } = {}) {
    const body = new FormData();
    for (const [key, value] of Object.entries({ country: 'CD', province: 'Kinshasa', position: 'manager', lastName: 'Candidate', firstName: 'Test', gender: 'F', profession: 'Manager', age: '30', phone: '+243850000000', email: 'candidate@example.test', city: 'Kinshasa', message: 'Private application text', consent: '1', t: String(NOW - 10000), ...overrides })) body.set(key, value);
    if (photo) body.set('photo', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], { type: 'image/png' }), 'profile.png');
    if (cv) body.set('cv', new Blob(['%PDF-1.4 Private CV body'], { type: 'application/pdf' }), 'resume.pdf');
    for (let i = 0; i < docs; i++) body.append('docs', new Blob(['%PDF-1.4 Private attachment'], { type: 'application/pdf' }), 'document' + i + '.pdf');
    return body;
}
function request(body = form(), origin = ORIGIN) {
    return new Request('https://app.cashpay-all.com/api/careers', { method: 'POST', headers: { origin }, body });
}

test('accepted candidature sends the validated attachments to the fixed mailbox without retaining a dossier', async () => {
    const f = fixture();
    const response = await f.handler(request(form({ to: 'attacker@example.test', MAIL_TO: 'attacker@example.test' })));
    const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.ok, true); assert.equal(body.saved, false); assert.equal(body.retryScheduled, false);
    assert.deepEqual(body.delivery, { internal: 'accepted', acknowledgement: 'accepted' });
    assert.match(body.ref, /^CP-\d{6}-[A-F0-9]+$/);
    assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const internal = f.messages.find(v => v.kind === 'internal').message;
    assert.deepEqual(recipients(internal.to), ['info@example.test']);
    assert.equal(internal.replyTo.address, 'candidate@example.test');
    assert.equal(internal.attachments.length, 4);
    assert.ok(['logo@cashpay', 'cp@cashpay', 'photo@cashpay'].every(cid => internal.attachments.some(v => v.cid === cid)));
    const ack = f.messages.find(v => v.kind === 'acknowledgement').message;
    assert.deepEqual(ack.attachments.map(v => v.cid).sort(), ['cp@cashpay', 'logo@cashpay', 'photo@cashpay']);
    assert.ok(!ack.attachments.some(v => /\.pdf$/i.test(v.filename)));
    assert.match(ack.html, /n'importe quel pays/); assert.match(ack.html, /cid:photo@cashpay/);
    const cv = internal.attachments.find(v => v.filename.endsWith('.pdf'));
    assert.equal(cv.content.toString(), '%PDF-1.4 Private CV body');
    assert.equal(f.messages.length, 2);
    assert.ok(f.transports.every(v => v.closed));
});

test('a resolved SMTP call with no intended accepted recipient is a failure and sends no acknowledgement', async t => {
    for (const accepted of [[], ['someone-else@example.test']]) await t.test(JSON.stringify(accepted), async () => {
        const f = fixture({ sendMail: async () => ({ accepted }) });
        const response = await f.handler(request()); const body = await response.json();
        assert.equal(response.status, 503); assert.equal(body.ok, false); assert.equal(body.saved, false);
        assert.equal(body.error, 'mail_unavailable');
        assert.deepEqual(body.delivery, { internal: 'failed', acknowledgement: 'not_sent' });
        assert.equal(f.messages.length, 1); assert.equal(f.messages[0].kind, 'internal');
        assert.ok(f.transports.every(v => v.closed));
    });
});

test('SMTP failure exposes safe diagnostics without application data, filenames or credentials', async () => {
    const f = fixture({ sendMail: async () => { throw Object.assign(Error(SECRET + ' Private CV body candidate@example.test'), { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN', response: SECRET }); } });
    const response = await f.handler(request()); const body = await response.json();
    assert.equal(response.status, 503); assert.equal(body.saved, false);
    const visible = JSON.stringify(body) + f.logs.join('\n');
    for (const privateValue of [SECRET, 'Private CV body', 'candidate@example.test', 'Private application text', 'resume.pdf']) assert.equal(visible.includes(privateValue), false, privateValue);
    assert.ok(f.logs.some(line => line.includes('EAUTH')));
    assert.ok(f.transports.every(v => v.closed));
});

test('an acknowledgement refusal preserves successful internal delivery and reports the partial result', async () => {
    const f = fixture({ sendMail: async (message, kind) => {
        if (kind === 'acknowledgement') throw Object.assign(Error('refused'), { code: 'EENVELOPE', responseCode: 550 });
        return { accepted: recipients(message.to) };
    } });
    const response = await f.handler(request()); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.ok, true); assert.equal(body.saved, false);
    assert.deepEqual(body.delivery, { internal: 'accepted', acknowledgement: 'failed' });
    assert.equal(body.retryScheduled, false); assert.equal(f.messages.length, 2);
});

test('missing sending configuration cannot become a simulated successful submission', async () => {
    const f = fixture({ env: { SMTP_PASSWORD: '' } });
    const response = await f.handler(request()); const body = await response.json();
    assert.equal(response.status, 503); assert.equal(body.ok, false); assert.equal(body.saved, false);
    assert.equal(f.messages.length, 0); assert.equal(f.transports.length, 0);
});

test('allowed preflight succeeds without opening a mail transport', async () => {
    const f = fixture();
    const response = await f.handler(new Request('https://app.cashpay-all.com/api/careers', { method: 'OPTIONS', headers: { origin: 'https://www.cashpay-all.com', 'access-control-request-method': 'POST' } }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://www.cashpay-all.com');
    assert.ok(response.headers.get('access-control-allow-methods').includes('POST'));
    assert.notEqual(response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(f.transports.length, 0);
});

test('a foreign origin is rejected before reading private documents', async () => {
    const f = fixture(), req = request(form(), 'https://foreign.example');
    const response = await f.handler(req);
    assert.equal(response.status, 403); assert.equal(req.bodyUsed, false);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(f.transports.length, 0);
});

test('invalid applicant data, honeypots and missing CV never reach the mailer', async t => {
    const disguised = form();
    disguised.set('cv', new Blob(['JavaScript or another non-PDF payload'], { type: 'application/pdf' }), 'resume.pdf');
    for (const [name, body] of [
        ['province', form({ province: 'Unknown province' })],
        ['honeypot', form({ website: 'spam' })],
        ['consent', form({ consent: '0' })],
        ['missing CV', form({}, { cv: false })],
        ['disguised CV', disguised],
        ['extra documents', form({}, { docs: 4 })]
    ]) await t.test(name, async () => {
        const f = fixture(), response = await f.handler(request(body));
        assert.ok(response.status >= 400 && response.status < 500);
        assert.equal((await response.json()).ok, false); assert.equal(f.transports.length, 0);
    });
});

test('repeated applications from the same address stop before another mail is sent', async () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) assert.equal((await f.handler(request())).status, 200);
    const sent = f.messages.length;
    const limited = await f.handler(request());
    assert.equal(limited.status, 429); assert.equal(f.messages.length, sent);
});

test('the actual chunked body is bounded even when Content-Length claims a smaller size', async () => {
    const f = fixture({ limits: { maxBodyBytes: 100 } });
    let cancelled = false;
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(80)); controller.enqueue(new Uint8Array(80)); }, cancel() { cancelled = true; } });
    const req = new Request('https://app.cashpay-all.com/api/careers', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'multipart/form-data; boundary=synthetic', 'content-length': '1' }, body: stream, duplex: 'half' });
    const response = await f.handler(req);
    assert.equal(response.status, 413); assert.equal(cancelled, true); assert.equal(f.transports.length, 0);
    assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
});

test('a declared oversized body is rejected before reading it', async () => {
    const f = fixture({ limits: { maxBodyBytes: 100 } });
    const req = new Request('https://app.cashpay-all.com/api/careers', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'multipart/form-data; boundary=synthetic', 'content-length': '101' }, body: 'unread' });
    const response = await f.handler(req);
    assert.equal(response.status, 413); assert.equal(req.bodyUsed, false); assert.equal(f.transports.length, 0);
});

test('a stalled upload times out, cancels its stream and releases the concurrency slot', async () => {
    const f = fixture({ limits: { maxReadMs: 10, maxConcurrent: 1 } });
    // Buffer the follow-up before starting the short timeout fixture. This check
    // exercises release of the slot, not FormData encoder scheduling under load.
    const followupForm = request();
    const followup = new Request(followupForm.url, { method: 'POST', headers: followupForm.headers, body: await followupForm.arrayBuffer() });
    let cancelled = false;
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('PRIVATE_PENDING_PAYLOAD')); }, cancel() { cancelled = true; } });
    const req = new Request('https://app.cashpay-all.com/api/careers', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'multipart/form-data; boundary=synthetic' }, body: stream, duplex: 'half' });
    const response = await f.handler(req); const body = await response.json();
    assert.equal(response.status, 408); assert.equal(body.ok, false); assert.equal(cancelled, true); assert.equal(f.transports.length, 0);
    assert.equal((JSON.stringify(body) + f.logs.join('\n')).includes('PRIVATE_PENDING_PAYLOAD'), false);
    assert.equal((await f.handler(followup)).status, 200);
});

test('the concurrency cap rejects a second upload and releases its slot after delivery', { timeout: 5000 }, async () => {
    let release, started;
    const gate = new Promise(resolve => { release = resolve; });
    const reached = new Promise(resolve => { started = resolve; });
    let first = true;
    const f = fixture({ limits: { maxConcurrent: 1 }, sendMail: async (message, kind) => {
        if (kind === 'internal' && first) { first = false; started(); await gate; }
        return { accepted: recipients(message.to) };
    } });
    const active = f.handler(request());
    await reached;
    const secondRequest = request(form({ email: 'second@example.test' }));
    const rejected = await f.handler(secondRequest);
    assert.ok([429, 503].includes(rejected.status)); assert.equal(secondRequest.bodyUsed, false); assert.equal(f.messages.length, 1);
    release(); assert.equal((await active).status, 200);
    assert.equal((await f.handler(request(form({ email: 'third@example.test' })))).status, 200);
});
