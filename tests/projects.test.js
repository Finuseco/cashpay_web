'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createProjectsHandler } = require('../src/lib/projects/handler');
const NOW = Date.parse('2026-11-18T20:00:00Z');
const rcpt = v => (Array.isArray(v) ? v : [v]).map(x => typeof x === 'string' ? x : x.address);
function fx() {
    const messages = [];
    const handler = createProjectsHandler({ env: { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465', SMTP_USER: 'noreply@example.test', SMTP_PASSWORD: 'x', CAREERS_MAIL_TO: 'info@example.test' }, clock: () => NOW, logger: { log() {}, error() {} },
        transportFactory: (o, kind) => ({ async sendMail(m) { messages.push({ kind, m }); return { accepted: rcpt(m.to) }; }, close() {} }) });
    return { handler, messages };
}
function form(o = {}, files = 0) {
    const b = new FormData();
    for (const [k, v] of Object.entries({ projectName: 'AgriPay', kind: 'startup', stage: 'prototype', sector: 'Agritech', country: 'CD', city: 'Kinshasa', amount: '15 000', description: 'Une plateforme mobile qui permet aux petits agriculteurs de vendre et d\'être payés en ligne, avec livraison.', useOfFunds: 'Développement', firstName: 'Test', lastName: 'Porteur', phone: '+243850000000', email: 'porteur@example.test', consent: '1', t: String(NOW - 10000), ...o })) b.set(k, v);
    for (let i = 0; i < files; i++) b.append('docs', new Blob(['%PDF-1.4 deck'], { type: 'application/pdf' }), 'deck' + i + '.pdf');
    return b;
}
const req = b => new Request('https://app.cashpay-all.com/api/projects', { method: 'POST', headers: { origin: 'https://cashpay-all.com' }, body: b });
test('projet valide : e-mail interne + accusé, rien conservé', async () => {
    const { handler, messages } = fx();
    const r = await handler(req(form({}, 1))); const j = await r.json();
    assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.saved, false); assert.match(j.ref, /^PR-/);
    assert.deepEqual(messages.map(x => x.kind), ['internal', 'acknowledgement']);
    assert.equal(messages[0].m.attachments.filter(a => /^Projet/.test(a.filename)).length, 1);
    assert.equal(messages[1].m.attachments.some(a => /^Projet/.test(a.filename)), false);
    assert.match(messages[0].m.subject, /AgriPay/); assert.match(messages[0].m.text, /15000 USD/);
});
test('refus : description courte, honeypot, trop rapide, origine', async () => {
    const { handler } = fx();
    assert.equal((await handler(req(form({ description: 'court' })))).status, 422);
    assert.equal((await handler(req(form({ website_hp: 'x' })))).status, 400);
    assert.equal((await handler(req(form({ t: String(NOW - 500) })))).status, 400);
    const bad = new Request('https://app.cashpay-all.com/api/projects', { method: 'POST', headers: { origin: 'https://evil.test' }, body: form() });
    assert.equal((await handler(bad)).status, 403);
});
