'use strict';

const { logos } = require('../careers/assets');

const LOGO_CID = 'main-newsletter-logo@cashpay';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// The logo is a trusted repository buffer, included in the message itself.
// No remote image request or filesystem attachment is needed by mail clients.
function newsletterAttachments() {
    return [{ filename: 'cashpay-all.png', content: Buffer.from(logos.wordmark), contentType: 'image/png', cid: LOGO_CID, contentDisposition: 'inline' }];
}

// Callers supply fixed HTML or the server-sanitized article body. Every string
// entering an attribute or text context is escaped by its caller or below.
function newsletterHtml({ title, bodyHtml, footerHtml = '', language = 'fr' }) {
    return `<!DOCTYPE html><html lang="${language === 'en' ? 'en' : 'fr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4eff9;color:#2e1841;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4eff9;padding:24px 12px"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden"><tr><td bgcolor="#190a28" style="background:#190a28;padding:26px 28px"><img src="cid:${LOGO_CID}" alt="CashPay All" width="160" height="49" style="display:block;width:160px;max-width:100%;height:auto;border:0"><p style="margin:16px 0 0;color:#d8b7f5;font-size:11px;font-weight:bold;letter-spacing:1.8px">NEWSLETTER</p></td></tr><tr><td bgcolor="#7a22d4" height="4" style="height:4px;background:#7a22d4;font-size:0;line-height:4px">&nbsp;</td></tr><tr><td style="padding:28px;font-size:16px;line-height:1.65"><h1 style="margin:0 0 20px;color:#190a28;font-size:26px;line-height:1.3">${escapeHtml(title)}</h1>${bodyHtml}</td></tr><tr><td style="padding:20px 28px;background:#faf7fd;border-top:1px solid #e6dcf0;font-size:12px;line-height:1.7;color:#6a6073">${footerHtml}<p style="margin:12px 0 0;color:#6a6073">CashPay All · FINUSECO SARL</p></td></tr></table></td></tr></table></body></html>`;
}

module.exports = { newsletterHtml, newsletterAttachments, escapeHtml, LOGO_CID };
