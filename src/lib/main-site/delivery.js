'use strict';
const crypto = require('node:crypto');
const { decodeHtmlEntities } = require('./articles');
const MAX_ATTEMPTS = 5;
const LEASE_MS = 2 * 60 * 1000;
const BACKOFF_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const recipientAddress = value => typeof value === 'string' ? value.trim().toLowerCase() : value && typeof value.address === 'string' ? value.address.trim().toLowerCase() : '';
async function sendAccepted(sendMail, payload) {
    const address = recipientAddress(payload.to);
    if (!address || /[\r\n]/.test(address)) throw new Error('INVALID_RECIPIENT');
    const result = await sendMail(payload);
    if (!result || !Array.isArray(result.accepted) || !result.accepted.some(value => recipientAddress(value) === address)) throw new Error('SMTP_NOT_ACCEPTED');
    return result;
}
function createStrictMailer(env = process.env, transportFactory) {
    return async payload => {
        const port = Number(env.SMTP_PORT || 587);
        if (!env.SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535 || !env.SMTP_USER || !(env.SMTP_PASSWORD || env.SMTP_PASS)) throw new Error('MAIN_MAIL_UNAVAILABLE');
        const createTransport = transportFactory || require('nodemailer').createTransport;
        const transport = createTransport({
            host: env.SMTP_HOST, port, secure: env.SMTP_SECURE === 'true' || port === 465,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD || env.SMTP_PASS },
            requireTLS: !(env.SMTP_SECURE === 'true' || port === 465),
            connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 15000,
            tls: { rejectUnauthorized: true }
        });
        let timer;
        try {
            const timeout = new Promise((resolve, reject) => {
                timer = setTimeout(() => { try { transport.close(); } catch {} reject(new Error('SMTP_DEADLINE_EXCEEDED')); }, 15000);
            });
            const result = await Promise.race([transport.sendMail({ ...payload, from: env.MAIL_FROM || env.SMTP_USER,
                ...(env.MAIL_REPLY_TO ? { replyTo: env.MAIL_REPLY_TO } : {}), disableFileAccess: true, disableUrlAccess: true }), timeout]);
            const address = recipientAddress(payload.to);
            if (!result || !Array.isArray(result.accepted) || !result.accepted.some(value => recipientAddress(value) === address)) throw new Error('SMTP_NOT_ACCEPTED');
            return result;
        } finally { clearTimeout(timer); try { transport.close(); } catch {} }
    };
}
async function transaction(db, action) {
    const client = await db.getConnection();
    try { await client.query('BEGIN'); const result = await action(client); await client.query('COMMIT'); return result; }
    catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; }
    finally { client.release(); }
}
function createDeliveryService({ db, sendMail, tokenSecret, baseUrl = 'https://www.cashpay-all.com', now = () => new Date(), sanitizeHtml }) {
    if (!db || typeof sendMail !== 'function') throw new Error('Newsletter database and mail sender are required.');
    if (typeof tokenSecret !== 'string' || tokenSecret.length < 32) throw new Error('MAIN_NEWSLETTER_TOKEN_SECRET must contain at least 32 characters.');
    if (typeof sanitizeHtml !== 'function') throw new Error('An article HTML sanitizer is required.');
    const origin = new URL(baseUrl).origin;
    const unsubscribeToken = (id, nonce) => crypto.createHmac('sha256', tokenSecret).update(`main-newsletter:unsubscribe:${id}:${nonce}`).digest('base64url');
    async function expandDue(at) {
        return transaction(db, async client => {
            const due = await client.query(`SELECT c.id FROM main_newsletter_campaigns c JOIN main_articles a ON a.id=c.article_id
                WHERE c.status='scheduled' AND c.due_at<=$1 AND a.status='published' AND a.publish_at<=$1
                ORDER BY c.due_at,c.id LIMIT 5 FOR UPDATE OF c SKIP LOCKED`, [at]);
            for (const campaign of due.rows) {
                await client.query(`INSERT INTO main_newsletter_deliveries (campaign_id,subscriber_id,status,next_attempt_at,created_at)
                    SELECT $1,id,'pending',$2,$2 FROM main_newsletter_subscribers WHERE status='active' AND confirmed_at IS NOT NULL AND unsubscribe_hash IS NOT NULL
                    ON CONFLICT (campaign_id,subscriber_id) DO NOTHING`, [campaign.id, at]);
                await client.query("UPDATE main_newsletter_campaigns SET status='sending',audience_expanded_at=$2,updated_at=$2 WHERE id=$1", [campaign.id, at]);
            }
            return due.rows.length;
        });
    }
    async function claimOne(at) {
        return transaction(db, async client => {
            await client.query(`UPDATE main_newsletter_deliveries SET status='failed',last_error='LEASE_ATTEMPTS_EXHAUSTED',lease_token=NULL,lease_expires_at=NULL
                WHERE status='leased' AND lease_expires_at<=$1 AND attempts>=$2`, [at, MAX_ATTEMPTS]);
            const row = (await client.query(`SELECT d.id FROM main_newsletter_deliveries d JOIN main_newsletter_campaigns c ON c.id=d.campaign_id
                WHERE c.status='sending' AND d.attempts<$2 AND ((d.status='pending' AND d.next_attempt_at<=$1) OR (d.status='leased' AND d.lease_expires_at<=$1))
                ORDER BY d.next_attempt_at,d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED`, [at, MAX_ATTEMPTS])).rows[0];
            if (!row) return null;
            const token = crypto.randomBytes(24).toString('base64url');
            return (await client.query(`UPDATE main_newsletter_deliveries SET status='leased',attempts=attempts+1,lease_token=$2,lease_expires_at=$3
                WHERE id=$1 RETURNING id,attempts,lease_token`, [row.id, token, new Date(at.getTime() + LEASE_MS)])).rows[0];
        });
    }
    async function finishCampaigns(at) {
        await db.query(`UPDATE main_newsletter_campaigns c SET status=CASE WHEN EXISTS
            (SELECT 1 FROM main_newsletter_deliveries d WHERE d.campaign_id=c.id AND d.status='failed') THEN 'failed' ELSE 'sent' END,
            completed_at=$1,updated_at=$1 WHERE c.status='sending' AND NOT EXISTS
            (SELECT 1 FROM main_newsletter_deliveries d WHERE d.campaign_id=c.id AND d.status IN ('pending','leased'))`, [at]);
    }
    return {
        async listCampaigns() {
            const result = await db.query(`SELECT c.id,c.article_id,c.subject,c.status,c.due_at,c.created_at,c.completed_at,
                COUNT(d.id)::int AS total,COUNT(d.id) FILTER (WHERE d.status='sent')::int AS sent,
                COUNT(d.id) FILTER (WHERE d.status='failed')::int AS failed,COUNT(d.id) FILTER (WHERE d.status='skipped')::int AS skipped,
                COUNT(d.id) FILTER (WHERE d.status IN ('pending','leased'))::int AS pending
                FROM main_newsletter_campaigns c LEFT JOIN main_newsletter_deliveries d ON d.campaign_id=c.id
                GROUP BY c.id ORDER BY c.created_at DESC,c.id DESC LIMIT 100`);
            return { ok: true, campaigns: result.rows.map(row => ({
                id: String(row.id), articleId: String(row.article_id), subject: row.subject, status: row.status,
                dueAt: row.due_at, createdAt: row.created_at, completedAt: row.completed_at,
                total: Number(row.total), sent: Number(row.sent), failed: Number(row.failed), skipped: Number(row.skipped), pending: Number(row.pending)
            })) };
        },
        async dispatchDue({ limit = 10, budgetMs = 40000, deadline } = {}) {
            const endAt = Math.min(Number.isFinite(deadline) ? deadline : Infinity, Date.now() + Math.max(0, Math.min(60000, Number.isFinite(budgetMs) ? budgetMs : 40000)));
            const maximum = Math.max(1, Math.min(100, Number.isInteger(limit) ? limit : 10));
            await db.query('DELETE FROM main_auth_rate_limits WHERE window_started_at<$1', [new Date(now().getTime() - 24 * 60 * 60 * 1000)]);
            await db.query('UPDATE main_newsletter_subscribers SET token_hash=NULL,token_expires_at=NULL WHERE token_expires_at<$1', [now()]);
            const stats = { expanded: await expandDue(now()), processed: 0, sent: 0, retried: 0, failed: 0, skipped: 0 };
            for (let index = 0; index < maximum && Date.now() < endAt - 15000; index++) {
                const lease = await claimOne(now());
                if (!lease) break;
                stats.processed++;
                // Recheck consent and public publication immediately before submitting to SMTP.
                const row = (await db.query(`SELECT s.id AS subscriber_id,s.email,s.language,s.unsubscribe_nonce,c.subject,c.body_html,c.body_text,c.article_url
                    FROM main_newsletter_deliveries d JOIN main_newsletter_subscribers s ON s.id=d.subscriber_id
                    JOIN main_newsletter_campaigns c ON c.id=d.campaign_id JOIN main_articles a ON a.id=c.article_id
                    WHERE d.id=$1 AND d.lease_token=$2 AND d.status='leased' AND s.status='active' AND s.confirmed_at IS NOT NULL
                    AND s.unsubscribe_hash IS NOT NULL AND c.status='sending' AND a.status='published' AND a.publish_at<=$3`, [lease.id, lease.lease_token, now()])).rows[0];
                if (!row) {
                    await db.query("UPDATE main_newsletter_deliveries SET status='skipped',last_error='CONSENT_OR_PUBLICATION_CHANGED',lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2", [lease.id, lease.lease_token]);
                    stats.skipped++; continue;
                }
                try {
                    const token = unsubscribeToken(row.subscriber_id, row.unsubscribe_nonce);
                    const unsubscribeUrl = `${origin}/newsletter.html?action=unsubscribe#${token}`;
                    const en = row.language === 'en';
                    const body = sanitizeHtml(row.body_html).replace(/<iframe\b[^>]*src=[\"'](https:\/\/[^\"']+)[\"'][^>]*>[\s\S]*?<\/iframe>/gi, (_, url) => `<p><a href=\"${escapeHtml(decodeHtmlEntities(url))}\">${en ? 'Watch the video' : 'Voir la vidéo'}</a></p>`);
                    const articleUrl = new URL(row.article_url);
                    if (articleUrl.protocol !== 'https:') throw new Error('INVALID_ARTICLE_URL');
                    await sendAccepted(sendMail, {
                        to: row.email, subject: row.subject,
                        messageId: `<main-newsletter-${lease.id}@cashpay-all.com>`,
                        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'Auto-Submitted': 'auto-generated' },
                        html: `<div style="font-family:Arial,sans-serif;color:#2e1841;max-width:680px;margin:auto;padding:28px"><p style="color:#7a22d4;font-weight:bold;letter-spacing:1px">CASHPAY ALL</p><h1 style="font-size:28px;line-height:1.25">${escapeHtml(row.subject)}</h1><div style="font-size:16px;line-height:1.65">${body}</div><p style="margin:28px 0"><a href="${escapeHtml(articleUrl.href)}" style="color:#7a22d4">${en ? 'Read on our website' : 'Lire sur notre site'}</a></p><hr style="border:0;border-top:1px solid #e6dcf0"><p style="font-size:12px;color:#6a6073">${en ? 'You receive this publication because you confirmed your CashPay All subscription.' : 'Vous recevez cette publication après avoir confirmé votre abonnement CashPay All.'} <a href="${escapeHtml(unsubscribeUrl)}">${en ? 'Unsubscribe' : 'Se désabonner'}</a></p></div>`,
                        text: `${row.subject}\n\n${row.body_text}\n\n${en ? 'Read on our website' : 'Lire sur notre site'}: ${articleUrl.href}\n\n${en ? 'Unsubscribe' : 'Se désabonner'}: ${unsubscribeUrl}`
                    });
                } catch {
                    const terminal = Number(lease.attempts) >= MAX_ATTEMPTS;
                    await db.query(`UPDATE main_newsletter_deliveries SET status=$3,last_error='SMTP_SUBMISSION_UNCONFIRMED',next_attempt_at=$4,lease_token=NULL,lease_expires_at=NULL
                        WHERE id=$1 AND lease_token=$2 AND status='leased'`, [lease.id, lease.lease_token, terminal ? 'failed' : 'pending', new Date(now().getTime() + BACKOFF_MS[Math.min(Number(lease.attempts) - 1, BACKOFF_MS.length - 1)])]);
                    stats[terminal ? 'failed' : 'retried']++;
                    continue;
                }
                // An SMTP acceptance followed by a database outage is ambiguous. Keep
                // the lease for recovery instead of classifying it as an SMTP rejection.
                await db.query("UPDATE main_newsletter_deliveries SET status='sent',sent_at=$3,last_error=NULL,lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND status='leased'", [lease.id, lease.lease_token, now()]);
                stats.sent++;
            }
            await finishCampaigns(now());
            return stats;
        }
    };
}
module.exports = { createDeliveryService, createStrictMailer, sendAccepted, escapeHtml, MAX_ATTEMPTS, LEASE_MS, BACKOFF_MS };
