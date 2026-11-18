'use strict';
/* Soumission de projets à financer : e-mail uniquement, rien n'est conservé sur le serveur. */
const { randomBytes, createHash } = require('node:crypto');
const { createMailer, mailbox, safeFailure } = require('../careers/mailer');
const { helpers: { readBody, line, name, error, signatures, ORIGINS, MiB } } = require('../careers/handler');
const templates = require('./templates');
const countries = require('../careers/jobs-data.json').countries;
const COUNTRY = new Map(countries.map(c => [c.code, c]));
const ext = { ...signatures, pptx: signatures.docx };

function createProjectsHandler({ env = process.env, transportFactory, clock = Date.now, logger = console, limits = {} } = {}) {
    const maxBodyBytes = limits.maxBodyBytes || 14 * MiB, maxReadMs = limits.maxReadMs || 60000, maxConcurrent = limits.maxConcurrent || 2;
    const salt = randomBytes(16), buckets = new Map(); let active = 0;
    function allow(value, maximum, duration) {
        const now = clock();
        for (const [k, b] of buckets) if (b.until <= now) buckets.delete(k);
        const key = createHash('sha256').update(salt).update(value).digest('hex'), current = buckets.get(key);
        if (current) return ++current.count <= maximum;
        if (buckets.size >= 5000) return false;
        buckets.set(key, { count: 1, until: now + duration }); return true;
    }
    const record = (ref, kind, outcome, reason) => { try { logger[outcome === 'accepted' ? 'log' : 'error']('[projects] mail ' + JSON.stringify({ ref, kind, status: outcome, ...(reason ? safeFailure(reason) : {}) })); } catch (_) {} };
    return async function handle(request) {
        const origin = request.headers.get('origin');
        const cors = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
        if (origin && ORIGINS.has(origin)) cors['Access-Control-Allow-Origin'] = origin;
        const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
        const failed = (status, code, message) => respond(status, { ok: false, saved: false, error: code, message });
        if (origin && !ORIGINS.has(origin)) return failed(403, 'origin', 'Origine non autorisée.');
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
        if (request.method !== 'POST') return failed(405, 'method', 'Méthode non autorisée.');
        if (active >= maxConcurrent) return failed(503, 'busy', 'Le service est occupé. Veuillez réessayer dans quelques instants.');
        const ip = env.CAREERS_TRUST_PROXY === '1' ? (request.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64) || 'unknown' : 'untrusted-proxy';
        if (!allow('ip:' + ip, 6, 3600000)) return failed(429, 'rate_limit', 'Trop de soumissions depuis cette connexion. Réessayez plus tard.');
        const contentType = request.headers.get('content-type') || '';
        if (!/^multipart\/form-data(?:;|$)/i.test(contentType)) return failed(400, 'bad_request', 'Requête invalide.');
        active++; let mailer;
        try {
            let form;
            const body = await readBody(request, maxBodyBytes, maxReadMs);
            try { form = await new Response(body, { headers: { 'content-type': contentType } }).formData(); } catch (_) { throw error(400, 'bad_request', 'Formulaire illisible.'); }
            const get = key => typeof form.get(key) === 'string' ? form.get(key) : '';
            if (get('website_hp')) throw error(400, 'bad_request', 'Requête invalide.');
            const started = Number(get('t'));
            if (!started || clock() - started < 4000) throw error(400, 'too_fast', 'Veuillez réessayer.');
            const amount = get('amount').replace(/[^\d.]/g, '');
            const d = { projectName: line(get('projectName'), 120), kind: get('kind'), stage: get('stage'), sector: line(get('sector'), 100), country: get('country'), city: line(get('city'), 80),
                amount: amount ? String(Math.round(Number(amount))) : '', description: get('description').replace(/\r\n/g, '\n').trim().slice(0, 6000), useOfFunds: get('useOfFunds').replace(/\r\n/g, '\n').trim().slice(0, 3000),
                firstName: line(get('firstName'), 80), lastName: line(get('lastName'), 80), role: line(get('role'), 80), phone: line(get('phone'), 30), email: line(get('email'), 120).toLowerCase(),
                website: line(get('website'), 200), lang: get('lang') === 'en' ? 'en' : 'fr' };
            const country = COUNTRY.get(d.country);
            if (!country) throw error(422, 'country', 'Pays invalide.');
            if (d.projectName.length < 2) throw error(422, 'projectName', 'Nom du projet requis.');
            if (!templates.KINDS[d.kind]) throw error(422, 'kind', 'Type de projet invalide.');
            if (!templates.STAGES[d.stage]) throw error(422, 'stage', 'Étape invalide.');
            if (d.sector.length < 2) throw error(422, 'sector', 'Secteur requis.');
            if (d.description.length < 50) throw error(422, 'description', 'Décrivez votre projet (au moins 50 caractères).');
            if (amount && (!Number.isFinite(Number(amount)) || Number(amount) > 100000000)) throw error(422, 'amount', 'Montant invalide.');
            if (d.firstName.length < 2 || d.lastName.length < 2) throw error(422, 'name', 'Nom et prénom requis.');
            if (!/^[+\d][\d\s().-]{6,24}$/.test(d.phone)) throw error(422, 'phone', 'Numéro de téléphone invalide.');
            if (mailbox(d.email) !== d.email) throw error(422, 'email', 'Adresse e-mail invalide.');
            if (d.website && !/^https?:\/\/[^\s]+$/i.test(d.website)) throw error(422, 'website', 'Lien invalide (commencez par https://).');
            if (get('consent') !== '1') throw error(422, 'consent', 'Consentement requis.');
            if (!allow('email:' + d.email, 3, 86400000)) throw error(429, 'rate_limit', 'Trop de soumissions pour cette adresse. Réessayez plus tard.');
            const raw = form.getAll('docs').filter(f => typeof f !== 'string' && f.size);
            if (raw.length > 2) throw error(422, 'docs', 'Deux documents au maximum.');
            const files = [];
            for (const [i, file] of raw.entries()) {
                if (file.size > 5 * MiB) throw error(422, 'doc_too_big', 'Un document dépasse 5 Mo.');
                const e = (String(file.name).split('.').pop() || '').toLowerCase();
                if (!['pdf', 'doc', 'docx', 'pptx'].includes(e)) throw error(422, 'doc_bad_type', 'Format refusé (PDF, Word ou PowerPoint).');
                const buf = Buffer.from(await file.arrayBuffer());
                if (!ext[e](buf)) throw error(422, 'doc_bad_type', 'Contenu de document refusé.');
                files.push({ name: 'Projet' + (i + 1) + '_' + name(file.name), buf });
            }
            const ref = 'PR-' + new Date(clock()).toISOString().slice(2, 10).replace(/-/g, '') + '-' + randomBytes(6).toString('hex').toUpperCase();
            const context = { ref, country: country.name, files: files.map(f => f.name) };
            mailer = createMailer({ env, transportFactory, templates, fromName: 'CashPay All Financement', idPrefix: 'projects', recipientEnv: 'PROJECTS_MAIL_TO' });
            try { await mailer.sendInternal(d, context, files); record(ref, 'internal', 'accepted'); }
            catch (reason) {
                record(ref, 'internal', 'failed', reason);
                return respond(503, { ok: false, ref, saved: false, error: 'mail_unavailable', message: 'L’envoi du projet n’a pas pu être confirmé. Vos documents ne sont pas conservés sur le serveur ; réessayez ou écrivez à info@cashpay-all.com.' });
            }
            let acknowledgement = 'accepted';
            try { await mailer.sendAcknowledgement(d, context, []); record(ref, 'acknowledgement', 'accepted'); } catch (reason) { acknowledgement = 'failed'; record(ref, 'acknowledgement', 'failed', reason); }
            return respond(200, { ok: true, ref, saved: false, delivery: { internal: 'accepted', acknowledgement } });
        } catch (reason) {
            return failed(reason.status || 500, reason.code && reason.publicMessage ? reason.code : 'server', reason.publicMessage || 'Erreur du serveur. Veuillez réessayer.');
        } finally { mailer?.close(); active--; }
    };
}
module.exports = { createProjectsHandler };
