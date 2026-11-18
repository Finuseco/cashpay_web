'use strict';

// Main has no server or credentials of its own. Only these HTTPS frontends
// may make credentialed browser requests to the isolated editorial API.
const allowedOrigins = new Set(['https://cashpay-all.com', 'https://www.cashpay-all.com', 'https://app.cashpay-all.com']);
class MainHttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function headers(request) {
  const result = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
  const origin = request.headers.get('origin');
  if (allowedOrigins.has(origin)) Object.assign(result, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' });
  return result;
}
function json(request, status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(request), 'Content-Type': 'application/json; charset=utf-8' } });
}
function requireOrigin(request) {
  if (!allowedOrigins.has(request.headers.get('origin'))) throw new MainHttpError(403, 'origin', 'Origine non autorisée.');
}
function preflight(request) {
  try { requireOrigin(request); }
  catch (e) { return json(request, e.status, { ok: false, error: e.code, message: e.message }); }
  return new Response(null, { status: 204, headers: { ...headers(request), 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
}
async function readJson(request, limit = 131072) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) throw new MainHttpError(415, 'content_type', 'Un document JSON est requis.');
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new MainHttpError(413, 'too_large', 'La requête est trop volumineuse.');
  if (!request.body) throw new MainHttpError(400, 'invalid_json', 'Document JSON invalide.');
  const reader = request.body.getReader(); let size = 0; const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new MainHttpError(413, 'too_large', 'La requête est trop volumineuse.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new MainHttpError(400, 'invalid_json', 'Document JSON invalide.'); }
}
function failure(request, error) {
  const known = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500;
  return json(request, known ? error.status : 503, { ok: false, error: known ? error.code : 'service_unavailable', message: known ? error.message : 'Service temporairement indisponible.' });
}
module.exports = { allowedOrigins, MainHttpError, json, preflight, requireOrigin, readJson, failure };
