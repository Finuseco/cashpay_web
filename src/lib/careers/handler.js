'use strict';
const { randomBytes, createHash } = require('node:crypto');
const { createMailer, mailbox, safeFailure } = require('./mailer');
const jobs = require('./jobs-data.json');
const ORIGINS = new Set(['https://cashpay-all.com', 'https://www.cashpay-all.com', 'https://app.cashpay-all.com']);
const MiB = 1024 * 1024;
const line = (value, max) => String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const name = value => line(value, 120).replace(/[^\w.\- ()éèêàçùôîï]/gi, '_') || 'fichier';
const error = (status, code, message) => Object.assign(new Error(), { status, code, publicMessage: message });
const signatures = {
    pdf: b => b.subarray(0, 5).toString('latin1') === '%PDF-',
    docx: b => b[0] === 0x50 && b[1] === 0x4b,
    doc: b => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
    jpg: b => b[0] === 0xff && b[1] === 0xd8, jpeg: b => b[0] === 0xff && b[1] === 0xd8,
    png: b => b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG',
    webp: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'
};
async function readBody(request, maxBytes, maxReadMs) {
    const length = request.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw error(413, 'too_big', 'Les fichiers sont trop volumineux.');
    if (!request.body) throw error(400, 'bad_request', 'Formulaire illisible.');
    const reader = request.body.getReader();
    let timer;
    try {
        const read = async () => {
            const chunks = []; let total = 0;
            for (;;) {
                const { value, done } = await reader.read(); if (done) break;
                total += value.byteLength;
                if (total > maxBytes) { reader.cancel().catch(() => {}); throw error(413, 'too_big', 'Les fichiers sont trop volumineux.'); }
                chunks.push(Buffer.from(value));
            }
            return Buffer.concat(chunks, total);
        };
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => { reader.cancel().catch(() => {}); reject(error(408, 'timeout', 'Le transfert a expiré. Veuillez réessayer.')); }, maxReadMs); });
        return await Promise.race([read(), timeout]);
    } finally { clearTimeout(timer); try { reader.releaseLock(); } catch (_) {} }
}

/** Mail-only endpoint. Payloads and buffers live only for the duration of this request. */
function createCareersHandler({ env = process.env, transportFactory, clock = Date.now, logger = console, limits = {}, catalog = jobs } = {}) {
    const maxBodyBytes = limits.maxBodyBytes || 22 * MiB;
    const maxConcurrent = limits.maxConcurrent || 2;
    const maxReadMs = limits.maxReadMs || 60000;
    const countries = new Map(catalog.countries.map(country => [country.code, country]));
    const positions = new Map(catalog.positions.map(position => [position.key, position]));
    const salt = randomBytes(16);
    const buckets = new Map(); let active = 0;
    function allow(value, maximum, duration) {
        const now = clock();
        for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
        const key = createHash('sha256').update(salt).update(value).digest('hex');
        const current = buckets.get(key);
        if (current) return ++current.count <= maximum;
        if (buckets.size >= 5000) return false;
        buckets.set(key, { count: 1, until: now + duration }); return true;
    }
    function record(ref, kind, outcome, reason) {
        const data = { ref, kind, status: outcome, ...(reason ? safeFailure(reason) : {}) };
        try { logger[outcome === 'accepted' ? 'log' : 'error']('[careers] mail ' + JSON.stringify(data)); } catch (_) {}
    }
    return async function handle(request) {
        const origin = request.headers.get('origin');
        const cors = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
        if (origin && ORIGINS.has(origin)) cors['Access-Control-Allow-Origin'] = origin;
        const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
        const failed = (status, code, message) => respond(status, { ok: false, saved: false, error: code, message });
        // Browser submissions must come from the named Main/app origins. Native
        // clients may omit Origin; this is not a substitute for rate limiting.
        if (origin && !ORIGINS.has(origin)) return failed(403, 'origin', 'Origine non autorisée.');
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
        if (request.method !== 'POST') return failed(405, 'method', 'Méthode non autorisée.');
        if (active >= maxConcurrent) return failed(503, 'busy', 'Le service est occupé. Veuillez réessayer dans quelques instants.');
        const ip = env.CAREERS_TRUST_PROXY === '1' ? (request.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64) || 'unknown' : 'untrusted-proxy';
        if (!allow('ip:' + ip, 6, 3600000)) return failed(429, 'rate_limit', 'Trop de candidatures depuis cette connexion. Réessayez plus tard.');
        const contentType = request.headers.get('content-type') || '';
        if (!/^multipart\/form-data(?:;|$)/i.test(contentType)) return failed(400, 'bad_request', 'Requête invalide.');
        active++;
        let mailer;
        try {
            let form;
            const body = await readBody(request, maxBodyBytes, maxReadMs);
            try { form = await new Response(body, { headers: { 'content-type': contentType } }).formData(); }
            catch (_) { throw error(400, 'bad_request', 'Formulaire illisible.'); }
            const get = key => typeof form.get(key) === 'string' ? form.get(key) : '';
            if (get('website')) throw error(400, 'bad_request', 'Requête invalide.');
            const started = Number(get('t'));
            if (!started || clock() - started < 4000) throw error(400, 'too_fast', 'Veuillez réessayer.');
            const data = { country: get('country'), province: line(get('province'), 80), position: get('position'),
                lastName: line(get('lastName'), 80), firstName: line(get('firstName'), 80), gender: get('gender'),
                profession: line(get('profession'), 100), age: Number(get('age')), phone: line(get('phone'), 30), email: line(get('email'), 120).toLowerCase(),
                city: line(get('city'), 80), message: get('message').replace(/\r\n/g, '\n').trim().slice(0, 4000), lang: get('lang') === 'en' ? 'en' : 'fr' };
            const country = countries.get(data.country), position = positions.get(data.position);
            if (!country) throw error(422, 'country', 'Pays invalide.');
            if (!position) throw error(422, 'position', 'Poste invalide.');
            if (!data.province || (country.provinces && !country.provinces.includes(data.province))) throw error(422, 'province', 'Province invalide.');
            if (data.lastName.length < 2 || data.firstName.length < 2) throw error(422, 'name', 'Nom et prénom requis.');
            if (!['M', 'F'].includes(data.gender)) throw error(422, 'gender', 'Sexe requis.');
            if (data.profession.length < 2) throw error(422, 'profession', 'Profession requise.');
            if (!Number.isInteger(data.age) || data.age < 16 || data.age > 80) throw error(422, 'age', 'Âge invalide.');
            if (!/^[+\d][\d\s().-]{6,24}$/.test(data.phone)) throw error(422, 'phone', 'Numéro de téléphone invalide.');
            if (mailbox(data.email) !== data.email) throw error(422, 'email', 'Adresse e-mail invalide.');
            if (get('consent') !== '1') throw error(422, 'consent', 'Consentement requis.');
            if (!allow('email:' + data.email, 3, 86400000)) throw error(429, 'rate_limit', 'Trop de candidatures pour cette adresse. Réessayez plus tard.');
            async function attachment(key, file, extensions, maxBytes, prefix) {
                if (!file || typeof file === 'string' || !file.size) throw error(422, key + '_missing', 'Pièce jointe obligatoire manquante.');
                if (file.size > maxBytes) throw error(422, key + '_too_big', 'Une pièce jointe dépasse la taille autorisée.');
                const extension = (String(file.name).split('.').pop() || '').toLowerCase();
                if (!extensions.includes(extension)) throw error(422, key + '_bad_type', 'Format de pièce jointe refusé.');
                const buf = Buffer.from(await file.arrayBuffer());
                if (!signatures[extension](buf)) throw error(422, key + '_bad_type', 'Contenu de pièce jointe refusé.');
                return { name: prefix + name(file.name), buf };
            }
            const docs = form.getAll('docs').filter(file => typeof file !== 'string' && file.size);
            if (docs.length > 3) throw error(422, 'docs', 'Trois documents supplémentaires au maximum.');
            const files = [await attachment('photo', form.get('photo'), ['jpg', 'jpeg', 'png', 'webp'], 3 * MiB, 'Photo_'),
                await attachment('cv', form.get('cv'), ['pdf', 'doc', 'docx'], 5 * MiB, 'CV_')];
            for (const [index, file] of docs.entries()) files.push(await attachment('doc', file, ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'], 5 * MiB, 'Doc' + (index + 1) + '_'));
            if (files.reduce((total, file) => total + file.buf.length, 0) > 15 * MiB) throw error(422, 'total_too_big', 'Les fichiers dépassent 15 Mo au total.');
            const ref = 'CP-' + new Date(clock()).toISOString().slice(2, 10).replace(/-/g, '') + '-' + randomBytes(6).toString('hex').toUpperCase();
            const context = { ref, position: position.fr, positionEn: position.en, country: country.name, files: files.map(file => file.name) };
            mailer = createMailer({ env, transportFactory });
            try { await mailer.sendInternal(data, context, files); record(ref, 'internal', 'accepted'); }
            catch (reason) {
                record(ref, 'internal', 'failed', reason);
                return respond(503, { ok: false, ref, saved: false, retryScheduled: false, error: 'mail_unavailable',
                    delivery: { internal: 'failed', acknowledgement: 'not_sent' }, message: 'L’envoi de la candidature n’a pas pu être confirmé. Vos documents ne sont pas conservés sur le serveur ; vérifiez la réception auprès du recrutement avant de soumettre à nouveau.' });
            }
            let acknowledgement = 'accepted';
            try { await mailer.sendAcknowledgement(data, context, files); record(ref, 'acknowledgement', 'accepted'); }
            catch (reason) { acknowledgement = 'failed'; record(ref, 'acknowledgement', 'failed', reason); }
            return respond(200, { ok: true, ref, saved: false, retryScheduled: false, delivery: { internal: 'accepted', acknowledgement } });
        } catch (reason) {
            return failed(reason.status || 500, reason.code && reason.publicMessage ? reason.code : 'server', reason.publicMessage || 'Erreur du serveur. Veuillez réessayer.');
        } finally { mailer?.close(); active--; }
    };
}
module.exports = { createCareersHandler, helpers: { readBody, line, name, error, signatures, ORIGINS, MiB } };
