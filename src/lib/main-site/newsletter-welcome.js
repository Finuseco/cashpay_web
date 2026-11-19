'use strict';

const { logos } = require('../careers/assets');
const { escapeHtml } = require('./newsletter-template');
const { welcomeIcons, welcomeIconAttachments } = require('./newsletter-welcome-assets');

const BRAND_CID = 'main-welcome-cp@cashpay';
const MAX_ARTICLES = 10;
const MAX_HTML_BYTES = 80000;
const DEFAULT_SOCIAL_LINKS = Object.freeze([
    Object.freeze({ kind: 'instagram', url: 'https://www.instagram.com/cashpay_all' }),
    Object.freeze({ kind: 'facebook', url: 'https://www.facebook.com/loanme.sfn' }),
    Object.freeze({ kind: 'linkedin', url: 'https://www.linkedin.com/posts/loanme-sfn' })
]);
const text = (value, maximum) => {
    const characters = Array.from(typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '');
    return characters.length > maximum ? characters.slice(0, maximum - 1).join('') + '…' : characters.join('');
};

function siteOrigin(value) {
    const url = new URL(value || 'https://cashpay-all.com');
    const localDevelopment = url.protocol === 'http:' && url.hostname === 'localhost';
    if ((!localDevelopment && url.protocol !== 'https:') || url.username || url.password || url.origin.length > 300 || !/^[a-z0-9.-]+$/i.test(url.hostname)) throw new TypeError('A public HTTPS Main origin is required.');
    return url.origin;
}
function safeImage(value) {
    if (typeof value !== 'string' || value.length > 1024 || /[\u0000-\u0020\u007f\\]/.test(value)) return '';
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
}
function articleList(input, origin) {
    const seen = new Set(), output = [];
    for (const article of Array.isArray(input) ? input : []) {
        if (!article || typeof article.slug !== 'string' || article.slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) || seen.has(article.slug)) continue;
        const title = text(article.title, 200);
        if (!title) continue;
        seen.add(article.slug);
        output.push({ title, excerpt: text(article.excerpt, 240), coverUrl: safeImage(article.coverUrl), coverAlt: text(article.coverAlt, 160), url: `${origin}/article.html?slug=${encodeURIComponent(article.slug)}` });
        if (output.length === MAX_ARTICLES) break;
    }
    return output;
}

const SOCIAL_HOSTS = {
    facebook: ['facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com'],
    instagram: ['instagram.com', 'www.instagram.com'],
    linkedin: ['linkedin.com', 'www.linkedin.com'],
    youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
    x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']
};
function additionalSocials(input) {
    const seen = new Set(), output = [];
    for (const item of Array.isArray(input) ? input : []) {
        if (!item || !SOCIAL_HOSTS[item.kind] || seen.has(item.kind) || typeof item.url !== 'string' || item.url.length > 512 || /[\u0000-\u0020\u007f\\]/.test(item.url)) continue;
        try {
            const url = new URL(item.url);
            if (url.protocol !== 'https:' || url.username || url.password || !SOCIAL_HOSTS[item.kind].includes(url.hostname)) continue;
            seen.add(item.kind); output.push({ kind: item.kind, url: url.href });
        } catch {}
    }
    return output;
}

/** A bounded, email-safe supplement for the confirmation email, after its CTA. */
function renderWelcomeContent({ articles = [], baseUrl = 'https://cashpay-all.com', language = 'fr', socialLinks = DEFAULT_SOCIAL_LINKS } = {}) {
    const origin = siteOrigin(baseUrl), en = language === 'en';
    const publications = articleList(articles, origin);
    const usedIcons = new Set();
    const icon = (key, size = 36) => {
        usedIcons.add(key);
        return `<img src="cid:${welcomeIcons[key].cid}" alt="" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border:0">`;
    };
    const heading = label => `<h2 style="margin:30px 0 16px;font-size:21px;line-height:1.35;color:#190a28">${escapeHtml(label)}</h2>`;
    const introTitle = en ? 'Welcome to the CashPay All ecosystem' : 'Bienvenue dans l’écosystème CashPay All';
    const intro = en ? 'CashPay All, a FINUSECO SARL brand, connects payments, transfers and digital services in one ecosystem. Explore our solutions for everyday needs, businesses and developers.' : 'CashPay All, une marque de FINUSECO SARL, réunit paiements, transferts et services numériques dans un même écosystème. Découvrez nos solutions pour le quotidien, les entreprises et les développeurs.';
    const aboutLabel = en ? 'About CashPay All' : 'À propos de CashPay All';
    const introHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f3eaff;border:1px solid #e6d6f7;border-radius:14px"><tr><td width="76" valign="top" style="padding:22px 0 22px 18px"><img src="cid:${BRAND_CID}" width="58" height="58" alt="CP" style="display:block;width:58px;height:auto;border:0"></td><td style="padding:20px 18px"><h2 style="margin:0 0 10px;color:#59158d;font-size:20px;line-height:1.35">${escapeHtml(introTitle)}</h2><p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#4f3a65">${escapeHtml(intro)}</p><a href="${origin}/apropos.html" style="font-size:13px;font-weight:bold;color:#691596;text-decoration:underline">${escapeHtml(aboutLabel)} →</a></td></tr></table>`;

    const recentHeading = en ? 'Our latest publications' : 'Nos dernières publications';
    const readLabel = en ? 'Read the article' : 'Lire l’article';
    const allLabel = en ? 'Explore all publications' : 'Voir toutes les publications';
    const fallbackExcerpt = en ? 'Discover the full publication on the CashPay All website.' : 'Découvrez la publication complète sur le site CashPay All.';
    function articleCards(covers) {
        if (!publications.length) return '';
        const rows = publications.map(article => `<tr><td style="padding:0 0 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9dff2;border-radius:12px;background:#ffffff"><tr><td width="88" valign="top" style="padding:16px 0 16px 12px"><a href="${escapeHtml(article.url)}" style="text-decoration:none"><img src="${escapeHtml(covers && article.coverUrl ? article.coverUrl : `cid:${BRAND_CID}`)}" alt="${escapeHtml(article.coverAlt || article.title)}" width="76" style="display:block;width:76px;max-width:100%;height:auto;border:0;border-radius:8px;background:#f3eaff"></a></td><td valign="top" style="padding:14px 14px 14px 12px"><h3 style="margin:0 0 7px;font-size:16px;line-height:1.4;color:#190a28"><a href="${escapeHtml(article.url)}" style="color:#190a28;text-decoration:none">${escapeHtml(article.title)}</a></h3><p style="margin:0 0 9px;font-size:13px;line-height:1.6;color:#655472">${escapeHtml(article.excerpt || fallbackExcerpt)}</p><a href="${escapeHtml(article.url)}" style="font-size:12px;font-weight:bold;color:#7a22d4;text-decoration:underline">${escapeHtml(readLabel)} →</a></td></tr></table></td></tr>`).join('');
        return heading(recentHeading) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table><p style="margin:6px 0 0"><a href="${origin}/articles.html" style="font-size:13px;font-weight:bold;color:#691596">${escapeHtml(allLabel)} →</a></p>`;
    }

    const services = en ? [
        ['payments', 'Payments & transfers', 'Discover CashPay solutions to pay, send and receive money.', '/services.html', '#eff7ff'],
        ['cards', 'Cards & business', 'Explore our card offers and tools for professional needs.', '/cartes-b2b.html', '#f4edff'],
        ['developers', 'Developer APIs', 'Connect digital payment and communication services to your applications.', '/developpeurs.html', '#edf8f2']
    ] : [
        ['payments', 'Paiements et transferts', 'Découvrez les solutions CashPay pour payer, envoyer et recevoir de l’argent.', '/services.html', '#eff7ff'],
        ['cards', 'Cartes et entreprises', 'Explorez nos offres de cartes et les outils destinés aux besoins professionnels.', '/cartes-b2b.html', '#f4edff'],
        ['developers', 'API pour développeurs', 'Connectez les services numériques de paiement et de communication à vos applications.', '/developpeurs.html', '#edf8f2']
    ];
    const serviceTitle = en ? 'Services to discover' : 'Des services à découvrir';
    const servicesHtml = heading(serviceTitle) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${services.map(([key, title, description, path, color]) => `<tr><td style="padding-bottom:10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${color};border-radius:12px"><tr><td width="62" valign="top" style="padding:17px 0 17px 16px">${icon(key)}</td><td style="padding:15px 16px 15px 0"><h3 style="margin:0 0 5px;font-size:15px;line-height:1.4"><a href="${origin}${path}" style="color:#190a28;text-decoration:none">${escapeHtml(title)} →</a></h3><p style="margin:0;color:#655472;font-size:13px;line-height:1.6">${escapeHtml(description)}</p></td></tr></table></td></tr>`).join('')}</table>`;

    const links = [
        { icon: 'whatsapp', label: en ? 'WhatsApp channel' : 'Chaîne WhatsApp', url: 'https://whatsapp.com/channel/0029VbC4htiHAdNTdwakAX1Y' },
        { icon: 'whatsapp', label: en ? 'Contact us on WhatsApp' : 'Nous contacter sur WhatsApp', url: 'https://wa.me/243853868021' },
        { icon: 'email', label: 'info@cashpay-all.com', url: 'mailto:info@cashpay-all.com' },
        { icon: 'website', label: en ? 'Visit our website' : 'Visiter notre site', url: origin }
    ];
    const labels = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', x: 'X' };
    for (const item of additionalSocials(socialLinks)) links.push({ icon: welcomeIcons[item.kind] ? item.kind : 'website', label: labels[item.kind], url: item.url });
    const contactsTitle = en ? 'Stay connected with CashPay All' : 'Gardons le contact avec CashPay All';
    const contactsHtml = heading(contactsTitle) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#190a28;border-radius:14px"><tr><td style="padding:16px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${links.map(link => `<tr><td width="40" style="padding:7px 0">${icon(link.icon, 28)}</td><td style="padding:7px 0;font-size:13px;line-height:1.5"><a href="${escapeHtml(link.url)}" style="color:#ffffff;text-decoration:none">${escapeHtml(link.label)} →</a></td></tr>`).join('')}</table></td></tr></table>`;

    let html = introHtml + articleCards(true) + servicesHtml + contactsHtml;
    // Rich-looking article cards remain bounded even for heavily escaped URLs.
    // Their trusted CP thumbnails replace oversized covers without dropping news.
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) html = introHtml + articleCards(false) + servicesHtml + contactsHtml;
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new RangeError('The welcome email supplement is too large.');
    const plain = [introTitle, intro, `${aboutLabel}: ${origin}/apropos.html`];
    if (publications.length) {
        plain.push('', recentHeading);
        for (const article of publications) plain.push(`\n${article.title}\n${article.excerpt || fallbackExcerpt}\n${article.url}`);
        plain.push(`${allLabel}: ${origin}/articles.html`);
    }
    plain.push('', serviceTitle);
    for (const [, title, description, path] of services) plain.push(`${title}\n${description}\n${origin}${path}`);
    plain.push('', contactsTitle, ...links.map(link => `${link.label}: ${link.url}`));
    return { html, text: plain.join('\n\n'), attachments: [
        { filename: 'cashpay-welcome-cp.png', content: Buffer.from(logos.cp), contentType: 'image/png', cid: BRAND_CID, contentDisposition: 'inline' },
        ...welcomeIconAttachments([...usedIcons])
    ] };
}

module.exports = { renderWelcomeContent, MAX_ARTICLES, MAX_HTML_BYTES };
