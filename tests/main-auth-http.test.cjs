'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthHandler } = require('../src/lib/main-site/auth-http.cjs');
const { createOtpDelivery } = require('../src/lib/main-site/auth-delivery.cjs');
const { MainAuthError } = require('../src/lib/main-site/auth-core.cjs');
const http = require('../src/lib/main-site/http.js');
const CHALLENGE = 'A'.repeat(43);
const SESSION = 'B'.repeat(43);
const USER = { id: 1, walletId: 'CD0100000001', fullName: 'Example', role: 'Admin' };

function fixture() {
  const calls = [];
  const auth = {
    async start(input) { calls.push(['start', input]); return { challengeToken: CHALLENGE, step: 'otp', channel: 'email', maskedDestination: 'a***@example.com', expiresAt: '2026-11-18T12:10:00Z' }; },
    async verifyOtp(token, otp) { calls.push(['otp', token, otp]); if (token !== CHALLENGE) throw new MainAuthError(401, 'INVALID_CHALLENGE', 'Recommencez.'); return { step: 'pin' }; },
    async verifyPin(token, pin) { calls.push(['pin', token, pin]); if (token !== CHALLENGE) throw new MainAuthError(401, 'INVALID_CHALLENGE', 'Recommencez.'); return { sessionToken: SESSION, user: USER, expiresAt: '2026-11-18T20:00:00Z' }; },
    async session(token) { calls.push(['session', token]); if (token !== SESSION) throw new MainAuthError(401, 'AUTH_REQUIRED', 'Connexion requise.'); return { user: USER, expiresAt: '2026-11-18T20:00:00Z' }; },
    async logout(...tokens) { calls.push(['logout', ...tokens]); },
  };
  const handler = createAuthHandler({ auth, http });
  return { handler, auth, calls };
}

function request(input = {}, options = {}) {
  return new Request('https://app.cashpay-all.com/api/main/auth/start', {
    method: 'POST', headers: { origin: 'https://cashpay-all.com', 'content-type': 'application/json', ...options.headers },
    body: options.raw === undefined ? JSON.stringify(input) : options.raw,
  });
}

test('start returns no challenge secret in JSON and sets a host-only secure HTTP-only cookie', async () => {
  const { handler, calls } = fixture();
  const response = await handler.handle(request({ walletId: 'CD0100000001', userId: 99, role: 'Admin' }), 'start');
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.equal(JSON.parse(text).ok, true);
  assert.equal(text.includes(CHALLENGE), false);
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 1);
  assert.match(cookies[0], /^__Host-cashpay-main-admin-challenge=/);
  for (const attr of ['Path=/', 'HttpOnly', 'SameSite=Strict', 'Secure', 'Max-Age=600']) assert.ok(cookies[0].includes(attr));
  assert.equal(cookies[0].includes('Domain='), false);
  assert.equal(calls[0][1].userId, undefined);
  assert.equal(calls[0][1].role, undefined);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://cashpay-all.com');
});

test('OTP and PIN read their bound cookie and ignore forged body challenge tokens', async () => {
  const { handler } = fixture();
  const denied = await handler.handle(request({ otp: '123456', challengeToken: CHALLENGE, userId: 1 }), 'otp');
  assert.equal(denied.status, 401);
  const otp = await handler.handle(request({ otp: '123456' }, { headers: { cookie: `${handler.challengeCookie}=${CHALLENGE}` } }), 'otp');
  assert.equal((await otp.json()).step, 'pin');
  const pin = await handler.handle(request({ pin: '1234' }, { headers: { cookie: `${handler.challengeCookie}=${CHALLENGE}` } }), 'pin');
  const text = await pin.text();
  assert.equal(text.includes(SESSION), false);
  assert.equal(text.includes(CHALLENGE), false);
  assert.deepEqual(JSON.parse(text).user, USER);
  assert.ok(pin.headers.getSetCookie().some(value => value.startsWith(`${handler.sessionCookie}=${SESSION}`) && value.includes('Max-Age=28800')));
  assert.ok(pin.headers.getSetCookie().some(value => value.startsWith(`${handler.challengeCookie}=`) && value.includes('Max-Age=0')));
});

test('wallet cookies, bearer JWTs, and URL query tokens never authenticate Main', async () => {
  const { handler } = fixture();
  const wallet = new Request(`https://app.cashpay-all.com/api/main/auth/session?token=${SESSION}`, { headers: { cookie: `cashpay-token=${SESSION}`, authorization: `Bearer ${SESSION}` } });
  assert.equal((await handler.handle(wallet, 'session')).status, 401);
  await assert.rejects(() => handler.requireMainAdmin(wallet), error => error.code === 'AUTH_REQUIRED');
  const valid = new Request('https://app.cashpay-all.com/api/main/auth/session', { headers: { cookie: `${handler.sessionCookie}=${SESSION}` } });
  assert.deepEqual(await handler.requireMainAdmin(valid), USER);
});

test('all auth mutations reject missing or foreign Origins before touching auth state', async () => {
  for (const action of ['start', 'otp', 'pin', 'logout']) {
    for (const origin of ['', 'https://evil.example', 'https://cashpay-all.com.evil.example', 'http://cashpay-all.com']) {
      const { handler, calls } = fixture();
      const response = await handler.handle(request({}, { headers: { origin } }), action);
      assert.equal(response.status, 403);
      assert.equal(calls.length, 0);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
  }
});

test('preflight permits credentialed Main origins and refuses other origins', async () => {
  const { handler } = fixture();
  for (const origin of ['https://cashpay-all.com', 'https://www.cashpay-all.com', 'https://app.cashpay-all.com']) {
    const response = handler.options(new Request('https://app.cashpay-all.com/api/main/auth/start', { method: 'OPTIONS', headers: { origin } }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
  }
  assert.equal(handler.options(new Request('https://app.cashpay-all.com/api/main/auth/start', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })).status, 403);
});

test('JSON parsing errors and oversized streamed bodies never reach auth', async () => {
  const { handler, calls } = fixture();
  for (const [raw, type, status] of [['{broken', 'application/json', 400], ['[]', 'application/json', 400], ['{}', 'text/plain', 415], [JSON.stringify({ padding: 'x'.repeat(5000) }), 'application/json', 413]]) {
    assert.equal((await handler.handle(request({}, { raw, headers: { 'content-type': type } }), 'start')).status, status);
  }
  assert.equal(calls.length, 0);
});

test('logout revokes cookie identities and clears both cookies', async () => {
  const { handler, calls } = fixture();
  const response = await handler.handle(request({}, { headers: { cookie: `${handler.sessionCookie}=${SESSION}; ${handler.challengeCookie}=${CHALLENGE}` } }), 'logout');
  assert.deepEqual(calls[0], ['logout', SESSION, CHALLENGE]);
  assert.equal(response.headers.getSetCookie().length, 2);
  for (const value of response.headers.getSetCookie()) assert.ok(value.includes('Max-Age=0'));
});

test('provider and database exception contents never leak in HTTP responses', async () => {
  const { handler, auth } = fixture();
  auth.start = async () => { throw new Error('database-password secret-otp-123456'); };
  const response = await handler.handle(request({ walletId: 'CD0100000001' }), 'start');
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('secret-otp'), false);
});

test('untrusted forwarded headers cannot bypass auth IP throttling', async () => {
  const { handler, auth, calls } = fixture();
  await handler.handle(request({ walletId: 'CD0100000001' }, { headers: { 'x-forwarded-for': '203.0.113.6', 'x-real-ip': '203.0.113.7' } }), 'start');
  assert.equal(calls[0][1].ip, 'unknown');
  const trusted = createAuthHandler({ auth, http, trustProxy: true });
  await trusted.handle(request({ walletId: 'CD0100000001' }, { headers: { 'x-forwarded-for': '203.0.113.8, 192.0.2.1' } }), 'start');
  assert.equal(calls[1][1].ip, '203.0.113.8');
});

test('missing provider configuration refuses OTP delivery without invoking mock-success services', async () => {
  const calls = [];
  const send = async (...args) => { calls.push(args); return { success: true }; };
  const deliver = createOtpDelivery({ sendEmail: send, sendSms: send, sendWhatsAppTextMessage: send, env: {} });
  for (const channel of ['email', 'sms', 'whatsapp']) assert.equal(await deliver({ user: { email: 'admin@example.com', phone: '243123456789' }, channel, otp: '123456' }), false);
  assert.equal(calls.length, 0);
});

test('configured delivery checks the actual existing provider result for every channel', async () => {
  const env = { SMTP_HOST: 'smtp.example.com', SMTP_USER: 'mail', SMTP_PASSWORD: 'secret', DREAM_DIGITAL_API_URL: 'https://sms.example.com', DREAM_DIGITAL_API_ID: 'id', DREAM_DIGITAL_API_PASSWORD: 'secret', WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_ACCESS_TOKEN: 'secret' };
  for (const channel of ['email', 'sms', 'whatsapp']) {
    for (const success of [false, true]) {
      const calls = [];
      const send = async (...args) => { calls.push(args); return { success }; };
      const deliver = createOtpDelivery({ sendEmail: send, sendSms: send, sendWhatsAppTextMessage: send, env });
      assert.equal(await deliver({ user: { email: 'admin@example.com', phone: '243123456789' }, channel, otp: '123456' }), success);
      assert.equal(calls.length, 1);
      assert.ok(JSON.stringify(calls[0]).includes('123456'));
    }
  }
});
