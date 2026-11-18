'use strict';
const crypto = require('node:crypto');
const { sendAccepted, escapeHtml } = require('./delivery');

const CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;
const CONFIRM_COOLDOWN_MS = 2 * 60 * 1000;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const unsubscribeToken = (id, nonce, secret) => crypto.createHmac('sha256', secret).update(`main-newsletter:unsubscribe:${id}:${nonce}`).digest('base64url');
const genericReceipt = () => ({ ok: true, message: 'Si cette adresse peut être inscrite, un lien de confirmation lui sera envoyé.' });
class NewsletterError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function normalizeEmail(value) {
    if (typeof value !== 'string') return '';
    const email = value.trim().toLowerCase();
    return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email) ? email : '';
}
async function transaction(db, operation) {
    const client = await db.getConnection();
    try { await client.query('BEGIN'); const value = await operation(client); await client.query('COMMIT'); return value; }
    catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; }
    finally { client.release(); }
}
function createNewsletterService({ db, sendMail, tokenSecret, baseUrl = 'https://www.cashpay-all.com', now = () => new Date(), randomToken = newToken }) {
    if (!db || typeof sendMail !== 'function') throw new Error('Newsletter database and mail sender are required.');
    if (typeof tokenSecret !== 'string' || tokenSecret.length < 32) throw new Error('MAIN_NEWSLETTER_TOKEN_SECRET must contain at least 32 characters.');
    const siteUrl = new URL(baseUrl);
    if (siteUrl.protocol !== 'https:' && siteUrl.hostname !== 'localhost') throw new Error('MAIN_SITE_URL must use HTTPS.');
    const pageLink = (action, token) => `${siteUrl.origin}/newsletter.html?action=${action}#${token}`;
    return {
        async subscribe(input = {}, { ip = 'unknown' } = {}) {
            const email = normalizeEmail(input.email);
            if (!email || input.consent !== true) throw new NewsletterError(400, 'INVALID_SUBSCRIPTION', 'Une adresse e-mail valide et votre consentement sont requis.');
            if (input.website) return genericReceipt();
            const startedAt = typeof input.startedAt === 'number' ? input.startedAt : Date.parse(input.startedAt);
            if (Number.isFinite(startedAt) && (now().getTime() - startedAt < 1200 || now().getTime() - startedAt > 24 * 60 * 60 * 1000)) return genericReceipt();
            const language = input.language === 'en' ? 'en' : 'fr';
            const at = now();
            const rate = await db.query(`INSERT INTO main_auth_rate_limits (key_hash,window_started_at,attempts) VALUES ($1,$2,1)
                ON CONFLICT (key_hash) DO UPDATE SET
                attempts=CASE WHEN main_auth_rate_limits.window_started_at<=$3 THEN 1 ELSE main_auth_rate_limits.attempts+1 END,
                window_started_at=CASE WHEN main_auth_rate_limits.window_started_at<=$3 THEN $2 ELSE main_auth_rate_limits.window_started_at END RETURNING attempts`,
                [digest(`main-newsletter:ip:${String(ip).slice(0,160)}`), at, new Date(at.getTime() - 15 * 60 * 1000)]);
            if (Number(rate.rows[0]?.attempts || 1) > (ip === 'unknown' ? 100 : 10)) throw new NewsletterError(429, 'RATE_LIMITED', 'Trop de demandes. Réessayez plus tard.');
            const rawToken = randomToken();
            const expires = new Date(at.getTime() + CONFIRM_TTL_MS);
            const prepared = await transaction(db, async client => {
                await client.query(`INSERT INTO main_newsletter_subscribers (email,language,status,consented_at,unsubscribe_nonce,created_at,updated_at)
                    VALUES ($1,$2,'pending',$3,$4,$3,$3) ON CONFLICT (email) DO NOTHING`, [email, language, at, randomToken()]);
                const row = (await client.query('SELECT * FROM main_newsletter_subscribers WHERE email=$1 FOR UPDATE', [email])).rows[0];
                if (!row || row.status === 'active') return null;
                if (row.token_expires_at && new Date(row.token_expires_at).getTime() > at.getTime() + CONFIRM_TTL_MS - CONFIRM_COOLDOWN_MS) return null;
                await client.query(`UPDATE main_newsletter_subscribers SET language=$2,status='pending',consented_at=$3,confirmed_at=NULL,
                    token_hash=$4,token_expires_at=$5,unsubscribe_nonce=$6,unsubscribe_hash=NULL,updated_at=$3 WHERE id=$1`,
                    [row.id, language, at, digest(rawToken), expires, randomToken()]);
                return { email, language };
            });
            if (!prepared) return genericReceipt();
            const en = language === 'en';
            const link = pageLink('confirm', rawToken);
            const subject = en ? 'Confirm your CashPay All subscription' : 'Confirmez votre abonnement CashPay All';
            try {
                await sendAccepted(sendMail, {
                    to: email, subject,
                    text: `${subject}\n\n${en ? 'Confirm your email to receive CashPay All publications. This link expires in 24 hours.' : 'Confirmez votre adresse pour recevoir les publications CashPay All. Ce lien expire dans 24 heures.'}\n\n${link}\n\n${en ? 'If you did not request this subscription, ignore this email.' : 'Si vous ne souhaitez pas vous inscrire, ignorez ce message.'}`,
                    html: `<div style="font-family:Arial,sans-serif;color:#2e1841;max-width:640px;margin:auto;padding:32px"><p style="color:#7a22d4;font-weight:bold">CASHPAY ALL</p><h1 style="font-size:26px">${escapeHtml(subject)}</h1><p>${en ? 'Confirm your email to receive our publications and newsletters.' : 'Confirmez votre adresse pour recevoir nos publications et newsletters.'}</p><p><a style="display:inline-block;background:#7a22d4;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none" href="${escapeHtml(link)}">${en ? 'Confirm my subscription' : 'Confirmer mon inscription'}</a></p><p style="font-size:13px;color:#6a6073">${en ? 'This link expires in 24 hours. Ignore this email if you did not request it.' : 'Ce lien expire dans 24 heures. Ignorez ce message si vous ne l’avez pas demandé.'}</p></div>`
                });
            } catch {
                // Do not log a capability or reveal whether an address is already subscribed.
                // Permit a later user-requested retry after a rejected SMTP submission.
                await db.query('UPDATE main_newsletter_subscribers SET token_hash=NULL,token_expires_at=NULL WHERE email=$1 AND token_hash=$2', [email, digest(rawToken)]);
                throw new NewsletterError(503, 'CONFIRMATION_UNAVAILABLE', 'L’envoi ne peut pas être confirmé. Réessayez plus tard.');
            }
            return genericReceipt();
        },
        async confirm(token) {
            if (!validToken(token)) throw new NewsletterError(400, 'INVALID_TOKEN', 'Ce lien est invalide ou a expiré.');
            const at = now();
            const confirmed = await transaction(db, async client => {
                const row = (await client.query("SELECT * FROM main_newsletter_subscribers WHERE token_hash=$1 AND status='pending' AND token_expires_at>$2 FOR UPDATE", [digest(token), at])).rows[0];
                if (!row) return false;
                const unsubHash = digest(unsubscribeToken(row.id, row.unsubscribe_nonce, tokenSecret));
                await client.query("UPDATE main_newsletter_subscribers SET status='active',confirmed_at=$2,unsubscribed_at=NULL,token_hash=NULL,token_expires_at=NULL,unsubscribe_hash=$3,updated_at=$2 WHERE id=$1", [row.id, at, unsubHash]);
                return true;
            });
            if (!confirmed) throw new NewsletterError(400, 'INVALID_TOKEN', 'Ce lien est invalide ou a expiré.');
            return { ok: true, status: 'active' };
        },
        async unsubscribe(token) {
            if (!validToken(token)) throw new NewsletterError(400, 'INVALID_TOKEN', 'Ce lien est invalide.');
            const at = now();
            const result = await db.query("UPDATE main_newsletter_subscribers SET status='unsubscribed',unsubscribed_at=$2,token_hash=NULL,token_expires_at=NULL,updated_at=$2 WHERE unsubscribe_hash=$1 AND status IN ('active','unsubscribed') RETURNING id", [digest(token), at]);
            if (!result.rows.length) throw new NewsletterError(400, 'INVALID_TOKEN', 'Ce lien est invalide.');
            return { ok: true, status: 'unsubscribed' };
        }
    };
}
module.exports = { createNewsletterService, NewsletterError, normalizeEmail, unsubscribeToken, digest, validToken, transaction, CONFIRM_TTL_MS };
