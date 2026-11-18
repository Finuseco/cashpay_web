'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createNewsletterService, unsubscribeToken, digest, normalizeEmail } = require('../src/lib/main-site/newsletter');
const { createDeliveryService, createStrictMailer, sendAccepted } = require('../src/lib/main-site/delivery');
const { sanitizeArticleHtml } = require('../src/lib/main-site/articles');
const at = new Date('2026-11-18T12:00:00.000Z');
const secret = 'newsletter-token-secret-at-least-32-characters';
const rawToken = 'A'.repeat(43);
const nonce = 'B'.repeat(43);
const subscriber = { id: '9', email: 'reader@example.com', status: 'pending', language: 'fr', unsubscribe_nonce: nonce, token_expires_at: null };
function database(handler) {
    const calls = [];
    const db = {
        calls,
        async query(sql, params = []) { calls.push({ sql, params }); return handler(sql, params) || { rows: [], rowCount: 0 }; },
        async getConnection() { return { query: db.query.bind(db), release() { calls.push({ sql: 'RELEASE', params: [] }); } }; }
    };
    return db;
}
function subscriptionFixture({ row = subscriber, mailResult, mailError } = {}) {
    const db = database(sql => /SELECT \* FROM main_newsletter_subscribers/.test(sql) ? { rows: row ? [row] : [] } : { rows: [], rowCount: 1 });
    const messages = [];
    let tokens = 0;
    const service = createNewsletterService({ db, tokenSecret: secret, now: () => at, randomToken: () => tokens++ ? nonce : rawToken,
        async sendMail(message) { messages.push(message); if (mailError) throw mailError; return mailResult || { accepted: [message.to] }; } });
    return { service, db, messages };
}
test('double opt-in stores only the confirmation hash and sends a fragment link without activating the subscriber', async () => {
    const { service, db, messages } = subscriptionFixture();
    assert.deepEqual(await service.subscribe({ email: ' Reader@Example.com ', language: 'en', consent: true }), { ok: true, message: 'Si cette adresse peut être inscrite, un lien de confirmation lui sera envoyé.' });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].to, 'reader@example.com');
    assert.match(messages[0].text, new RegExp(`newsletter\\.html\\?action=confirm#${rawToken}`));
    const update = db.calls.find(call => /SET language=/.test(call.sql));
    assert.equal(update.params[3], digest(rawToken));
    assert.equal(update.params[4].getTime(), at.getTime() + 24 * 60 * 60 * 1000);
    assert.equal(JSON.stringify(db.calls).includes(rawToken), false);
    assert.equal(db.calls.some(call => /status='active'/.test(call.sql)), false);
    assert.match(update.sql, /consented_at/);
    assert.equal(db.calls.at(-1).sql, 'RELEASE');
});
test('active subscriptions and confirmation cooldowns return the same generic receipt without sending mail', async () => {
    const active = subscriptionFixture({ row: { ...subscriber, status: 'active' } });
    const pending = subscriptionFixture({ row: { ...subscriber, token_expires_at: new Date(at.getTime() + 24 * 60 * 60 * 1000) } });
    const first = await active.service.subscribe({ email: subscriber.email, consent: true });
    const second = await pending.service.subscribe({ email: subscriber.email, consent: true });
    assert.deepEqual(first, second);
    assert.equal(active.messages.length, 0);
    assert.equal(pending.messages.length, 0);
    assert.equal(active.db.calls.some(call => /SET language=/.test(call.sql)), false);
});
test('subscription requires consent and a valid address, ignores honeypots, and fails on unaccepted SMTP', async () => {
    const fixture = subscriptionFixture({ mailResult: { accepted: [] } });
    await assert.rejects(fixture.service.subscribe({ email: subscriber.email, consent: false }), { status: 400 });
    await assert.rejects(fixture.service.subscribe({ email: 'reader\r\nBcc:other@example.com', consent: true }), { status: 400 });
    assert.equal((await fixture.service.subscribe({ email: subscriber.email, consent: true, website: 'bot' })).ok, true);
    assert.equal(fixture.db.calls.length, 0);
    await assert.rejects(fixture.service.subscribe({ email: subscriber.email, consent: true }), { status: 503, code: 'CONFIRMATION_UNAVAILABLE' });
    assert.ok(fixture.db.calls.some(call => /SET token_hash=NULL,token_expires_at=NULL/.test(call.sql)));
});
test('confirmation is single use, hashes the stable scoped unsubscribe capability, and expired links fail', async () => {
    let consumed = false;
    const db = database(sql => {
        if (/SELECT \*/.test(sql)) return { rows: consumed ? [] : [subscriber] };
        if (/SET status='active'/.test(sql)) consumed = true;
        return { rows: [], rowCount: 1 };
    });
    const service = createNewsletterService({ db, tokenSecret: secret, now: () => at, sendMail: async () => assert.fail('Confirmation must not send a campaign') });
    assert.deepEqual(await service.confirm(rawToken), { ok: true, status: 'active' });
    const query = db.calls.find(call => /SELECT \*/.test(call.sql));
    assert.equal(query.params[0], digest(rawToken));
    assert.match(query.sql, /status='pending' AND token_expires_at>\$2 FOR UPDATE/);
    const update = db.calls.find(call => /SET status='active'/.test(call.sql));
    assert.equal(update.params[2], digest(unsubscribeToken('9', nonce, secret)));
    assert.match(update.sql, /token_hash=NULL,token_expires_at=NULL/);
    await assert.rejects(service.confirm(rawToken), { status: 400, code: 'INVALID_TOKEN' });
    await assert.rejects(service.confirm('bad'), { status: 400 });
});
test('unsubscribe is idempotent and a later subscription re-enters pending confirmation', async () => {
    const db = database(sql => /RETURNING id/.test(sql) ? { rows: [{ id: '9' }] } : /SELECT \*/.test(sql) ? { rows: [{ ...subscriber, status: 'unsubscribed' }] } : { rows: [], rowCount: 1 });
    const messages = [];
    const service = createNewsletterService({ db, tokenSecret: secret, now: () => at, sendMail: async message => { messages.push(message); return { accepted: [message.to] }; } });
    const token = unsubscribeToken('9', nonce, secret);
    assert.equal((await service.unsubscribe(token)).status, 'unsubscribed');
    assert.equal((await service.unsubscribe(token)).status, 'unsubscribed');
    assert.equal(db.calls[0].params[0], digest(token));
    assert.match(db.calls[0].sql, /status IN \('active','unsubscribed'\)/);
    await service.subscribe({ email: subscriber.email, consent: true });
    assert.equal(messages.length, 1);
    assert.ok(db.calls.some(call => /status='pending'/.test(call.sql)));
    assert.equal(db.calls.some(call => /main_contacts|main_contact/.test(call.sql)), false);
});
function deliveryFixture({ accepted = true, consent = true, attempts = 1, bodyHtml, ackError = false } = {}) {
    let claims = 0;
    const row = { subscriber_id: '9', email: subscriber.email, language: 'fr', unsubscribe_nonce: nonce, subject: 'Notre communiqué', body_html: '<p>Publication <strong>complète</strong>.</p><iframe src="https://www.youtube.com/embed/abcdefg"></iframe><script>alert(1)</script>', body_text: 'Publication complète.', article_url: 'https://www.cashpay-all.com/article.html?slug=communique' };
    if (bodyHtml !== undefined) row.body_html = bodyHtml;
    const db = database(sql => {
        if (ackError && /status='sent',sent_at/.test(sql)) throw new Error('Database unavailable after SMTP acceptance');
        if (/SELECT c.id FROM/.test(sql)) return { rows: [{ id: '3' }] };
        if (/SELECT d.id FROM/.test(sql)) return { rows: claims++ ? [] : [{ id: '4' }] };
        if (/RETURNING id,attempts,lease_token/.test(sql)) return { rows: [{ id: '4', attempts, lease_token: 'worker-token' }] };
        if (/SELECT s.id AS/.test(sql)) return { rows: consent ? [row] : [] };
        return { rows: [], rowCount: 1 };
    });
    const messages = [];
    const service = createDeliveryService({ db, tokenSecret: secret, now: () => at, sanitizeHtml: sanitizeArticleHtml,
        sendMail: async message => { messages.push(message); return { accepted: accepted ? [message.to] : [] }; } });
    return { service, db, messages };
}
test('campaign dispatch expands current active subscribers, claims with SKIP LOCKED, and sends the full sanitized article', async () => {
    const fixture = deliveryFixture();
    const stats = await fixture.service.dispatchDue({ limit: 2 });
    assert.deepEqual(stats, { expanded: 1, processed: 1, sent: 1, retried: 0, failed: 0, skipped: 0 });
    assert.equal(fixture.messages.length, 1);
    const message = fixture.messages[0];
    assert.match(message.html, /Publication <strong>complète<\/strong>/);
    assert.doesNotMatch(message.html, /<script|<iframe|alert\(1\)/);
    assert.match(message.html, /Voir la vidéo/);
    assert.match(message.text, /Publication complète\./);
    assert.match(message.headers['List-Unsubscribe'], /newsletter\.html\?action=unsubscribe#[A-Za-z0-9_-]{43}/);
    assert.equal(message.messageId, '<main-newsletter-4@cashpay-all.com>');
    const expansion = fixture.db.calls.find(call => /INSERT INTO main_newsletter_deliveries/.test(call.sql));
    assert.match(expansion.sql, /status='active' AND confirmed_at IS NOT NULL/);
    assert.match(expansion.sql, /ON CONFLICT \(campaign_id,subscriber_id\) DO NOTHING/);
    assert.ok(fixture.db.calls.filter(call => /SKIP LOCKED/.test(call.sql)).length >= 2);
    assert.ok(fixture.db.calls.some(call => /status='sent',sent_at/.test(call.sql)));
});
test('SMTP rejection retries with backoff and becomes terminal at the bounded fifth attempt', async () => {
    const retry = deliveryFixture({ accepted: false });
    assert.equal((await retry.service.dispatchDue({ limit: 1 })).retried, 1);
    const retryUpdate = retry.db.calls.find(call => /SMTP_SUBMISSION_UNCONFIRMED/.test(call.sql));
    assert.equal(retryUpdate.params[2], 'pending');
    assert.equal(retryUpdate.params[3].getTime(), at.getTime() + 60000);
    assert.equal(retry.db.calls.some(call => /status='sent',sent_at/.test(call.sql)), false);
    const final = deliveryFixture({ accepted: false, attempts: 5 });
    assert.equal((await final.service.dispatchDue({ limit: 1 })).failed, 1);
    assert.equal(final.db.calls.find(call => /SMTP_SUBMISSION_UNCONFIRMED/.test(call.sql)).params[2], 'failed');
});
test('a subscriber who withdrew consent before SMTP is skipped without mail', async () => {
    const fixture = deliveryFixture({ consent: false });
    assert.equal((await fixture.service.dispatchDue({ limit: 1 })).skipped, 1);
    assert.equal(fixture.messages.length, 0);
    const consentCheck = fixture.db.calls.find(call => /SELECT s.id AS/.test(call.sql));
    assert.match(consentCheck.sql, /s.status='active'/);
    assert.ok(fixture.db.calls.some(call => /CONSENT_OR_PUBLICATION_CHANGED/.test(call.sql)));
});
test('the scoped mailer keeps existing SMTP configuration, requires acceptance and forbids file or URL attachments', async () => {
    let configuration, payload, closes = 0;
    const env = { SMTP_HOST: 'mail.example.com', SMTP_PORT: '587', SMTP_USER: 'mailer@example.com', SMTP_PASSWORD: 'preferred', SMTP_PASS: 'fallback', MAIL_FROM: 'CashPay <mailer@example.com>', MAIL_REPLY_TO: 'info@cashpay-all.com' };
    const mailer = createStrictMailer(env, config => { configuration = config; return { async sendMail(input) { payload = input; return { accepted: [input.to] }; }, close() { closes++; } }; });
    await sendAccepted(mailer, { to: subscriber.email, subject: 'Test', text: 'Content', html: '<p>Content</p>' });
    assert.equal(configuration.auth.pass, 'preferred');
    assert.equal(configuration.requireTLS, true);
    assert.equal(payload.from, env.MAIL_FROM);
    assert.equal(payload.replyTo, env.MAIL_REPLY_TO);
    assert.equal(payload.disableFileAccess, true);
    assert.equal(payload.disableUrlAccess, true);
    assert.equal(closes, 1);
    await assert.rejects(createStrictMailer({})( { to: subscriber.email } ), /MAIN_MAIL_UNAVAILABLE/);
    await assert.rejects(sendAccepted(async () => ({ accepted: ['different@example.com'] }), { to: subscriber.email }), /SMTP_NOT_ACCEPTED/);
});
test('only POST capabilities activate or unsubscribe, and internal dispatch requires a header secret', () => {
    for (const action of ['confirm', 'unsubscribe']) {
        const route = fs.readFileSync(path.join(__dirname, `../src/app/api/main/newsletter/${action}/route.ts`), 'utf8');
        assert.match(route, /export async function POST/);
        assert.doesNotMatch(route, /export (?:async function|const) GET/);
        assert.match(route, /requireOrigin\(request\)/);
    }
    const route = fs.readFileSync(path.join(__dirname, '../src/app/api/main/internal/dispatch/route.ts'), 'utf8');
    assert.match(route, /headers\.get\('authorization'\)/);
    assert.match(route, /timingSafeEqual/);
    assert.doesNotMatch(route, /searchParams|export async function GET/);
    const campaigns = fs.readFileSync(path.join(__dirname, '../src/app/api/main/admin/campaigns/route.ts'), 'utf8');
    assert.ok(campaigns.indexOf('await requireMainAdmin(request)') < campaigns.indexOf('await getDeliveryService().listCampaigns()'));
    assert.equal(normalizeEmail(' USER@Example.com '), 'user@example.com');
});

test('subscription rate limiting is atomic and a dispatch budget cannot start late SMTP work', async () => {
    const db = database(sql => /RETURNING attempts/.test(sql) ? { rows: [{ attempts: 11 }] } : { rows: [] });
    const service = createNewsletterService({ db, tokenSecret: secret, now: () => at, sendMail: async () => assert.fail('Rate-limited subscription must not send') });
    await assert.rejects(service.subscribe({ email: subscriber.email, consent: true }, { ip: '192.0.2.10' }), { status: 429 });
    assert.match(db.calls[0].sql, /ON CONFLICT \(key_hash\) DO UPDATE/);
    assert.equal(db.calls[0].params[0], digest('main-newsletter:ip:192.0.2.10'));
    const fixture = deliveryFixture();
    const result = await fixture.service.dispatchDue({ deadline: Date.now() - 1 });
    assert.equal(result.processed, 0);
    assert.equal(fixture.messages.length, 0);
    assert.ok(fixture.db.calls.some(call => /DELETE FROM main_auth_rate_limits/.test(call.sql)));
});

test('Facebook embeds become email links without double-escaping query parameters', async () => {
    const fixture = deliveryFixture({ bodyHtml: '<p>Une vidéo.</p><iframe src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fexample%2Fvideos%2F123&amp;show_text=false"></iframe>' });
    assert.equal((await fixture.service.dispatchDue({ limit: 1, budgetMs: 20000 })).sent, 1);
    assert.match(fixture.messages[0].html, /&amp;show_text=false/);
    assert.doesNotMatch(fixture.messages[0].html, /&amp;amp;/);
    assert.doesNotMatch(fixture.messages[0].html, /<iframe/);
});

test('accepted SMTP followed by a database acknowledgement failure preserves the lease for recovery', async () => {
    const fixture = deliveryFixture({ ackError: true });
    await assert.rejects(fixture.service.dispatchDue({ limit: 1 }), /Database unavailable after SMTP acceptance/);
    assert.equal(fixture.messages.length, 1);
    assert.equal(fixture.db.calls.some(call => /SMTP_SUBMISSION_UNCONFIRMED/.test(call.sql)), false);
    assert.equal(fixture.db.calls.some(call => /status='leased',attempts=attempts/.test(call.sql)), true);
});
