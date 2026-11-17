'use strict';
const templates = require('./templates');

function mailbox(value) {
    const raw = String(value || '').trim();
    if (/[\r\n\u0000]/.test(raw)) return null;
    const bracket = raw.match(/^[^<>]*<([^<>]+)>$/);
    const address = bracket ? bracket[1] : raw;
    return /^[^\s@<>()\[\],;:"\\]+@[^\s@<>()\[\],;:"\\]+\.[^\s@<>()\[\],;:"\\]+$/.test(address) ? address.toLowerCase() : null;
}
const fault = code => Object.assign(new Error(), { code });
const CODES = new Set(['EAUTH', 'ESOCKET', 'ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EHOSTUNREACH', 'EAI_AGAIN', 'EENVELOPE', 'EMESSAGE', 'ETLS', 'ECERT', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID', 'MODULE_NOT_FOUND', 'SMTP_NOT_CONFIGURED', 'NOREPLY_NOT_CONFIGURED', 'MAIL_ADDRESS_INVALID', 'RECIPIENT_NOT_ACCEPTED']);
function safeFailure(error) {
    return { code: CODES.has(error && error.code) ? error.code : 'SMTP_SEND_FAILED',
        ...(Number.isInteger(error && error.responseCode) && error.responseCode >= 100 && error.responseCode <= 599 ? { responseCode: error.responseCode } : {}) };
}
const password = (env, key) => env[key + '_PASSWORD'] !== undefined ? env[key + '_PASSWORD'] : env[key + '_PASS'];

/** Only transient SMTP transports and attachment buffers; no storage or retry queue. */
function createMailer({ env, transportFactory } = {}) {
    const factory = transportFactory || (options => require('nodemailer').createTransport(options));
    const transports = [];
    const recipient = mailbox(env.CAREERS_MAIL_TO || 'info@cashpay-all.com');
    const main = { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), user: env.SMTP_USER, pass: password(env, 'SMTP') };
    const dedicated = Boolean(env.NOREPLY_SMTP_USER || password(env, 'NOREPLY_SMTP'));
    const reply = dedicated ? { host: env.NOREPLY_SMTP_HOST || main.host, port: Number(env.NOREPLY_SMTP_PORT || main.port), user: env.NOREPLY_SMTP_USER, pass: password(env, 'NOREPLY_SMTP') } : main;
    async function deliver(kind, data, context, files) {
        const smtp = kind === 'internal' ? main : reply;
        const sender = mailbox(kind === 'internal' ? env.CAREERS_MAIL_FROM || env.MAIL_FROM || smtp.user : env.MAIL_NOREPLY || smtp.user);
        const to = kind === 'internal' ? recipient : mailbox(data.email);
        if (!smtp.host || !smtp.user || !smtp.pass || !Number.isInteger(smtp.port) || smtp.port < 1 || smtp.port > 65535) throw fault(kind === 'internal' ? 'SMTP_NOT_CONFIGURED' : 'NOREPLY_NOT_CONFIGURED');
        if (!sender || !to || !recipient) throw fault('MAIL_ADDRESS_INVALID');
        const transport = factory({ host: smtp.host, port: smtp.port, secure: smtp.port === 465,
            requireTLS: smtp.port !== 465, auth: { user: smtp.user, pass: smtp.pass }, tls: { rejectUnauthorized: true },
            connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 }, kind);
        transports.push(transport);
        const template = kind === 'internal' ? templates.internal(data, context) : templates.acknowledgement(data, context);
        const message = { from: { name: kind === 'internal' ? 'CashPay All Carrières' : 'CashPay All', address: sender },
            to: [to], replyTo: kind === 'internal' ? { name: data.firstName + ' ' + data.lastName, address: data.email } : recipient,
            subject: template.subject, text: template.text, html: template.html,
            messageId: '<careers.' + context.ref + '.' + kind + '@' + sender.split('@')[1] + '>',
            disableFileAccess: true, disableUrlAccess: true,
            ...(kind === 'internal' ? { attachments: files.map(file => ({ filename: file.name, content: file.buf, ...(file.name.startsWith('Photo_') ? { cid: 'photo@cashpay' } : {}) })) }
                : { headers: { 'Auto-Submitted': 'auto-replied', 'X-Auto-Response-Suppress': 'All' } }) };
        let timer;
        try {
            const timeout = new Promise((_, reject) => { timer = setTimeout(() => { try { transport.close?.(); } catch (_) {} reject(fault('ETIMEDOUT')); }, 25000); });
            const result = await Promise.race([transport.sendMail(message), timeout]);
            const accepted = (result && result.accepted || []).map(value => mailbox(typeof value === 'string' ? value : value && value.address));
            if (!accepted.includes(to)) throw fault('RECIPIENT_NOT_ACCEPTED');
        } finally { clearTimeout(timer); }
    }
    return { sendInternal: (data, context, files) => deliver('internal', data, context, files),
        sendAcknowledgement: (data, context) => deliver('acknowledgement', data, context, []),
        close() { for (const transport of transports) try { transport.close?.(); } catch (_) {} } };
}
module.exports = { createMailer, mailbox, safeFailure };
