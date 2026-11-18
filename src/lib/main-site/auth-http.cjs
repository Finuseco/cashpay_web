'use strict';

const { MainAuthError, CHALLENGE_TTL_MS, SESSION_TTL_MS } = require('./auth-core.cjs');

function cookie(request, name) {
  const item = (request.headers.get('cookie') || '').split(';').find(value => value.trim().startsWith(`${name}=`));
  if (!item) return undefined;
  try { return decodeURIComponent(item.trim().slice(name.length + 1)); } catch { return undefined; }
}

function createAuthHandler({ auth, http, development = false, trustProxy = false }) {
  const sessionCookie = development ? 'cashpay-main-admin-session-dev' : '__Host-cashpay-main-admin-session';
  const challengeCookie = development ? 'cashpay-main-admin-challenge-dev' : '__Host-cashpay-main-admin-challenge';
  function setCookie(response, name, token, maxAge) {
    response.headers.append('Set-Cookie', `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${development ? '' : '; Secure'}`);
  }
  return {
    sessionCookie,
    challengeCookie,
    async requireMainAdmin(request) { return (await auth.session(cookie(request, sessionCookie))).user; },
    options(request) { return http.preflight(request); },
    async handle(request, action) {
      try {
        if (action === 'session') return http.json(request, 200, { ok: true, ...await auth.session(cookie(request, sessionCookie)) });
        http.requireOrigin(request);
        if (action === 'logout') {
          await auth.logout(cookie(request, sessionCookie), cookie(request, challengeCookie));
          const response = http.json(request, 200, { ok: true });
          setCookie(response, sessionCookie, '', 0);
          setCookie(response, challengeCookie, '', 0);
          return response;
        }
        const input = await http.readJson(request, 4096);
        if (action === 'start') {
          const { challengeToken, ...result } = await auth.start({
            walletId: input.walletId, channel: input.channel,
            ip: trustProxy ? (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() : 'unknown',
          });
          const response = http.json(request, 200, { ok: true, ...result });
          setCookie(response, challengeCookie, challengeToken, CHALLENGE_TTL_MS / 1000);
          return response;
        }
        if (action === 'otp') return http.json(request, 200, { ok: true, ...await auth.verifyOtp(cookie(request, challengeCookie), input.otp) });
        if (action !== 'pin') throw new MainAuthError(404, 'NOT_FOUND', 'Route introuvable.');
        const { sessionToken, ...result } = await auth.verifyPin(cookie(request, challengeCookie), input.pin);
        const response = http.json(request, 200, { ok: true, ...result });
        setCookie(response, sessionCookie, sessionToken, SESSION_TTL_MS / 1000);
        setCookie(response, challengeCookie, '', 0);
        return response;
      } catch (error) {
        if (error instanceof MainAuthError || error instanceof http.MainHttpError) return http.json(request, error.status, { ok: false, code: error.code, error: error.code, message: error.message });
        return http.json(request, 503, { ok: false, code: 'INTERNAL_ERROR', error: 'INTERNAL_ERROR', message: 'Le service de connexion est momentanément indisponible.' });
      }
    },
  };
}

module.exports = { createAuthHandler };
