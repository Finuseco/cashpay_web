'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMainAuth, digest, AUDIENCE } = require('../src/lib/main-site/auth-core.cjs');

function fixture(options = {}) {
  let state = {
    users: new Map([[1, { id: 1, id_wallet: 'CD0100000001', role: 'Admin', status: 'Active', full_name: 'Admin Example', email: 'admin@example.com', phone: '243123456789', pin_hash: '1234' }]]),
    challenges: new Map(), sessions: new Map(), rates: new Map(),
  };
  let time = new Date('2026-11-18T12:00:00Z');
  let queue = Promise.resolve();
  const delivered = [];
  const store = {
    async transaction(callback) {
      const previous = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await previous;
      const snapshot = structuredClone(state);
      const tx = {
        async incrementRate(key, at, duration) {
          const row = state.rates.get(key);
          const attempts = row && row.at > at.getTime() - duration ? row.attempts + 1 : 1;
          state.rates.set(key, { at: attempts === 1 ? at.getTime() : row.at, attempts });
          return attempts;
        },
        async findUserByWallet(wallet) { return [...state.users.values()].find(user => user.id_wallet === wallet); },
        async invalidateChallenges(userId, at) {
          for (const row of state.challenges.values()) if (row.user_id === userId && !row.consumed_at) row.consumed_at = at;
        },
        async insertChallenge(row) { state.challenges.set(row.id, { ...row, otp_attempts: 0, pin_attempts: 0 }); },
        async lockChallenge(hash) {
          const row = [...state.challenges.values()].find(challenge => challenge.token_hash === hash);
          return row ? { ...row, user: state.users.get(row.user_id) } : null;
        },
        async updateChallenge(id, changes) { Object.assign(state.challenges.get(id), changes); },
        async insertSession(row) {
          if (options.sessionInsertFails) throw new Error('Database write failed');
          state.sessions.set(row.id, row);
        },
      };
      try { return await callback(tx); } catch (error) { state = snapshot; throw error; } finally { release(); }
    },
    async revokeChallenge(id, at) { state.challenges.get(id).consumed_at = at; },
    async revokeChallengeByToken(hash, at) {
      const row = [...state.challenges.values()].find(value => value.token_hash === hash);
      if (row) row.consumed_at = at;
    },
    async findSession(hash) {
      const row = [...state.sessions.values()].find(value => value.token_hash === hash);
      return row ? { ...row, user: state.users.get(row.user_id) } : null;
    },
    async revokeSession(hash, at) {
      const row = [...state.sessions.values()].find(value => value.token_hash === hash);
      if (row) row.revoked_at = at;
    },
  };
  const auth = createMainAuth({
    store,
    now: () => new Date(time),
    checkPin: async (pin, user) => pin === user.pin_hash,
    deliverOtp: async request => { delivered.push(request); return !options.deliveryFails; },
  });
  const start = extra => auth.start({ walletId: 'CD0100000001', ip: '203.0.113.1', ...extra });
  const otp = async challenge => auth.verifyOtp(challenge.challengeToken, delivered.at(-1).otp);
  const login = async () => { const challenge = await start(); await otp(challenge); return auth.verifyPin(challenge.challengeToken, '1234'); };
  return { auth, start, otp, login, delivered, state: () => state, advance: ms => { time = new Date(time.getTime() + ms); } };
}

const rejectsCode = (action, code) => assert.rejects(action, error => error.code === code);

test('complete OTP then PIN creates only a Main audience session, storing only token and OTP hashes', async () => {
  const f = fixture();
  const challenge = await f.start();
  assert.equal(challenge.maskedDestination, 'a***@example.com');
  assert.equal(f.state().sessions.size, 0);
  const row = [...f.state().challenges.values()][0];
  assert.equal(row.token_hash, digest(challenge.challengeToken));
  assert.notEqual(row.otp_hash, f.delivered[0].otp);
  await f.otp(challenge);
  assert.equal(f.state().sessions.size, 0);
  const session = await f.auth.verifyPin(challenge.challengeToken, '1234');
  assert.deepEqual(session.user, { id: 1, walletId: 'CD0100000001', fullName: 'Admin Example', role: 'Admin' });
  assert.equal([...f.state().sessions.values()][0].audience, AUDIENCE);
  assert.deepEqual(await f.auth.session(session.sessionToken), { user: session.user, expiresAt: session.expiresAt });
});

test('PIN alone and arbitrary user identifiers cannot bypass the OTP challenge', async () => {
  const f = fixture();
  const challenge = await f.start();
  await rejectsCode(() => f.auth.verifyPin(challenge.challengeToken, '1234'), 'OTP_REQUIRED');
  await rejectsCode(() => f.auth.verifyPin('1', '1234'), 'INVALID_CHALLENGE');
  assert.equal(f.state().sessions.size, 0);
});

test('only active database Admin users may start, regardless of a claimed role', async () => {
  for (const change of [{ role: 'Client' }, { role: 'admin' }, { status: 'Suspended' }]) {
    const f = fixture();
    Object.assign(f.state().users.get(1), change);
    await rejectsCode(() => f.start({ role: 'Admin' }), 'LOGIN_UNAVAILABLE');
    assert.equal(f.delivered.length, 0);
  }
});

test('OTP is bound to its own challenge and restarting invalidates the old challenge', async () => {
  const f = fixture();
  const first = await f.start();
  const oldOtp = f.delivered[0].otp;
  const second = await f.start();
  await rejectsCode(() => f.auth.verifyOtp(first.challengeToken, oldOtp), 'INVALID_CHALLENGE');
  // Even knowledge of the OTP hash from another challenge does not bind it to this token.
  const secondRow = [...f.state().challenges.values()][1];
  secondRow.otp_hash = digest(`${first.challengeToken}:${oldOtp}`);
  await rejectsCode(() => f.auth.verifyOtp(second.challengeToken, oldOtp), 'INVALID_OTP');
});

test('five failed OTP attempts permanently consume the challenge and counters persist', async () => {
  const f = fixture();
  const challenge = await f.start();
  const wrong = f.delivered[0].otp === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i += 1) await rejectsCode(() => f.auth.verifyOtp(challenge.challengeToken, wrong), 'INVALID_OTP');
  assert.equal([...f.state().challenges.values()][0].otp_attempts, 5);
  await rejectsCode(() => f.otp(challenge), 'INVALID_CHALLENGE');
});

test('OTP cannot be replayed and five failed PIN attempts consume its verified challenge', async () => {
  const f = fixture();
  const challenge = await f.start();
  await f.otp(challenge);
  await rejectsCode(() => f.otp(challenge), 'OTP_ALREADY_VERIFIED');
  for (let i = 0; i < 5; i += 1) await rejectsCode(() => f.auth.verifyPin(challenge.challengeToken, '9999'), 'INVALID_PIN');
  await rejectsCode(() => f.auth.verifyPin(challenge.challengeToken, '1234'), 'INVALID_CHALLENGE');
  assert.equal(f.state().sessions.size, 0);
});

test('challenge TTL applies to both the OTP and PIN stages', async () => {
  for (const verified of [false, true]) {
    const f = fixture();
    const challenge = await f.start();
    if (verified) await f.otp(challenge);
    f.advance(10 * 60 * 1000);
    await rejectsCode(() => verified ? f.auth.verifyPin(challenge.challengeToken, '1234') : f.otp(challenge), 'INVALID_CHALLENGE');
  }
});

test('role and account status changes invalidate verified challenges and existing sessions', async () => {
  const f = fixture();
  const session = await f.login();
  const nextChallenge = await f.start();
  await f.otp(nextChallenge);
  f.state().users.get(1).role = 'Client';
  await rejectsCode(() => f.auth.verifyPin(nextChallenge.challengeToken, '1234'), 'INVALID_CHALLENGE');
  await rejectsCode(() => f.auth.session(session.sessionToken), 'AUTH_REQUIRED');
  f.state().users.get(1).role = 'Admin';
  f.state().users.get(1).status = 'Suspended';
  await rejectsCode(() => f.auth.session(session.sessionToken), 'AUTH_REQUIRED');
});

test('sessions enforce audience, absolute expiry, revocation, and opaque token format', async () => {
  const f = fixture();
  const session = await f.login();
  const row = [...f.state().sessions.values()][0];
  row.audience = 'wallet';
  await rejectsCode(() => f.auth.session(session.sessionToken), 'AUTH_REQUIRED');
  row.audience = AUDIENCE;
  await rejectsCode(() => f.auth.session('eyJ.wallet.jwt'), 'AUTH_REQUIRED');
  f.advance(8 * 60 * 60 * 1000);
  await rejectsCode(() => f.auth.session(session.sessionToken), 'AUTH_REQUIRED');
  const fresh = fixture();
  const current = await fresh.login();
  await fresh.auth.logout(current.sessionToken);
  await rejectsCode(() => fresh.auth.session(current.sessionToken), 'AUTH_REQUIRED');
});

test('concurrent successful PIN requests consume the challenge once', async () => {
  const f = fixture();
  const challenge = await f.start();
  await f.otp(challenge);
  const attempts = await Promise.allSettled([f.auth.verifyPin(challenge.challengeToken, '1234'), f.auth.verifyPin(challenge.challengeToken, '1234')]);
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(f.state().sessions.size, 1);
});

test('failed session persistence rolls back consumption so a valid PIN can be retried', async () => {
  const options = { sessionInsertFails: true };
  const f = fixture(options);
  const challenge = await f.start();
  await f.otp(challenge);
  await assert.rejects(() => f.auth.verifyPin(challenge.challengeToken, '1234'), /Database write failed/);
  assert.equal([...f.state().challenges.values()][0].consumed_at, undefined);
  assert.equal([...f.state().challenges.values()][0].pin_attempts, 0);
  options.sessionInsertFails = false;
  assert.ok((await f.auth.verifyPin(challenge.challengeToken, '1234')).sessionToken);
});

test('failed real delivery consumes its challenge, with no backup OTP in the error', async () => {
  const f = fixture({ deliveryFails: true });
  await assert.rejects(() => f.start(), error => error.code === 'DELIVERY_FAILED' && !JSON.stringify(error).includes(f.delivered[0].otp));
  assert.ok([...f.state().challenges.values()][0].consumed_at);
  assert.equal(f.state().sessions.size, 0);
});

test('persisted per-wallet start limits survive invalid credentials and reset after their window', async () => {
  const f = fixture();
  for (let i = 0; i < 5; i += 1) await rejectsCode(() => f.start({ walletId: 'UNKNOWN1234' }), 'LOGIN_UNAVAILABLE');
  await rejectsCode(() => f.start({ walletId: 'UNKNOWN1234' }), 'RATE_LIMITED');
  f.advance(15 * 60 * 1000);
  await rejectsCode(() => f.start({ walletId: 'UNKNOWN1234' }), 'LOGIN_UNAVAILABLE');
});

test('persisted per-IP start limits apply across arbitrary wallet IDs', async () => {
  const f = fixture();
  for (let i = 0; i < 20; i += 1) await rejectsCode(() => f.start({ walletId: `UNKNOWN${i}` }), 'LOGIN_UNAVAILABLE');
  await rejectsCode(() => f.start({ walletId: 'ANOTHER123' }), 'RATE_LIMITED');
});
