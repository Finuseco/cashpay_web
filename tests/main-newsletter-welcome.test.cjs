'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderWelcomeContent, MAX_HTML_BYTES } = require('../src/lib/main-site/newsletter-welcome');
const { logos } = require('../src/lib/careers/assets');

const article = (number, extra = {}) => ({ slug: `publication-${number}`, title: `Publication ${number}`, excerpt: `An actual editorial excerpt for publication ${number}.`, coverUrl: `https://images.example.test/${number}.png`, coverAlt: `Cover ${number}`, ...extra });

test('the welcome supplement includes at most ten real distinct articles with excerpts and links to Main', () => {
    const articles = Array.from({ length: 13 }, (_, i) => article(i + 1));
    articles.splice(1, 0, article(1));
    const mail = renderWelcomeContent({ articles, baseUrl: 'https://cashpay-all.com/path?unused=1' });
    const slugs = new Set([...mail.html.matchAll(/href="https:\/\/cashpay-all\.com\/article\.html\?slug=([^"&]+)/g)].map(match => match[1]));
    assert.equal(slugs.size, 10);
    assert.ok(slugs.has('publication-1')); assert.ok(slugs.has('publication-10'));
    assert.equal(slugs.has('publication-11'), false);
    assert.match(mail.html, /An actual editorial excerpt/);
    assert.match(mail.text, /publication-10/); assert.doesNotMatch(mail.text, /publication-11/);
    assert.match(mail.html, /Nos dernières publications/);
});

test('article strings are escaped and bounded, while unsafe thumbnails never become image sources', () => {
    const unsafe = ['javascript:alert(1)', 'data:image/png,test', 'http://images.example.test/x', 'https://user:pass@images.example.test/x', 'https://images.example.test/a\nb', 'https://images.example.test\\bad'];
    const mail = renderWelcomeContent({ articles: unsafe.map((coverUrl, i) => article(i + 1, { title: '<img src=x onerror=alert(1)>', excerpt: '<script>unsafe</script>' + 'e'.repeat(500), coverUrl, coverAlt: '" onerror="bad' })) });
    assert.doesNotMatch(mail.html, /<script>|<img src=x|src="(?:javascript|data|http):|src="https:\/\/user:pass/);
    assert.match(mail.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(mail.html, /alt="&quot; onerror=&quot;bad"/);
    assert.match(mail.html, /src="cid:main-welcome-cp@cashpay"/);
    assert.doesNotMatch(mail.text, new RegExp('e'.repeat(241)));
    assert.match(renderWelcomeContent({ articles: [article(1, { coverUrl: 'https://images.example.test/a.png?a=1&b=2' })] }).html, /a\.png\?a=1&amp;b=2/);
});

test('an empty or malformed feed shows useful about, services and contact content without fabricated articles', () => {
    const mail = renderWelcomeContent({ articles: null });
    assert.match(mail.html, /Bienvenue dans l’écosystème CashPay All/);
    assert.match(mail.html, /FINUSECO SARL/);
    for (const path of ['apropos.html', 'services.html', 'cartes-b2b.html', 'developpeurs.html']) assert.ok(mail.html.includes(`https://cashpay-all.com/${path}`));
    assert.match(mail.html, /Paiements et transferts/); assert.match(mail.html, /API pour développeurs/);
    assert.doesNotMatch(mail.html, /Nos dernières publications|article\.html\?slug=/);
    assert.match(mail.text, /Des services à découvrir/);
});

test('verified contacts and the exact user-provided social destinations appear without invented or tracking links', () => {
    const mail = renderWelcomeContent();
    for (const url of ['https://whatsapp.com/channel/0029VbC4htiHAdNTdwakAX1Y', 'https://wa.me/243853868021', 'mailto:info@cashpay-all.com']) assert.ok(mail.html.includes(`href="${url}"`));
    for (const url of ['https://www.instagram.com/cashpay_all', 'https://www.facebook.com/loanme.sfn', 'https://www.linkedin.com/posts/loanme-sfn']) assert.ok(mail.html.includes(`href="${url}"`));
    assert.doesNotMatch(mail.html, /href="#"|avpt=|linkedin\.com\/company/);
    const custom = renderWelcomeContent({ socialLinks: [{ kind: 'facebook', url: 'https://www.facebook.com/verified-page' }, { kind: 'instagram', url: 'https://instagram.com.attacker.test/fake' }, { kind: 'linkedin', url: 'javascript:alert(1)' }] });
    assert.match(custom.html, /href="https:\/\/www\.facebook\.com\/verified-page"/);
    assert.doesNotMatch(custom.html, /attacker\.test|javascript:/);
});

test('the English alternative includes equivalent services, article excerpts and plain-text destinations', () => {
    const mail = renderWelcomeContent({ language: 'en', articles: [article(1)] });
    assert.match(mail.html, /Welcome to the CashPay All ecosystem/);
    assert.match(mail.html, /Our latest publications|Services to discover|Developer APIs|WhatsApp channel/);
    assert.match(mail.text, /https:\/\/cashpay-all\.com\/article\.html\?slug=publication-1/);
    assert.match(mail.text, /mailto:info@cashpay-all\.com/);
    assert.doesNotMatch(mail.html, /Confirm my subscription|Confirmer mon inscription/);
});

test('trusted inline PNGs supply the illustrations and social/service icons with independent buffers', () => {
    const mail = renderWelcomeContent();
    const ids = new Set(mail.attachments.map(item => item.cid));
    assert.equal(ids.size, mail.attachments.length);
    for (const match of mail.html.matchAll(/src="cid:([^"]+)"/g)) assert.ok(ids.has(match[1]), match[1]);
    assert.equal(mail.attachments.length, 10);
    for (const item of mail.attachments) {
        assert.equal(item.contentType, 'image/png'); assert.equal(item.contentDisposition, 'inline');
        assert.ok(Buffer.isBuffer(item.content)); assert.equal(item.content.subarray(1, 4).toString(), 'PNG');
        assert.equal('path' in item, false); assert.equal('href' in item, false);
    }
    const original = logos.cp[0]; mail.attachments[0].content[0] = 0;
    assert.equal(logos.cp[0], original);
    assert.doesNotMatch(mail.html, /<script|<svg|font-awesome|fonts\.googleapis/);
});

test('oversized escaped covers fall back to embedded artwork while preserving ten articles and a bounded email', () => {
    const mail = renderWelcomeContent({ articles: Array.from({ length: 10 }, (_, i) => article(i + 1, { title: '"'.repeat(200), excerpt: '"'.repeat(240), coverAlt: '"'.repeat(160), coverUrl: 'https://images.example.test/' + '&'.repeat(960) })) });
    assert.ok(Buffer.byteLength(mail.html, 'utf8') <= MAX_HTML_BYTES);
    assert.doesNotMatch(mail.html, /src="https:\/\/images\.example\.test/);
    assert.equal(new Set([...mail.html.matchAll(/article\.html\?slug=(publication-\d+)/g)].map(match => match[1])).size, 10);
});

test('invalid slugs, duplicate rows and private article fields cannot create arbitrary links or leak bodies', () => {
    const mail = renderWelcomeContent({ articles: [null, article(1, { slug: 'javascript:alert(1)' }), article(2, { slug: '../private' }), article(3, { bodyHtml: 'PRIVATE_BODY_NOT_FOR_THE_CONFIRMATION_MAIL', url: 'https://attacker.test/steal' }), article(3), article(4, { title: '' })] });
    assert.doesNotMatch(mail.html + mail.text, /PRIVATE_BODY|attacker\.test|javascript:|\.\.\/private/);
    assert.equal(new Set([...mail.html.matchAll(/article\.html\?slug=(publication-\d+)/g)].map(match => match[1])).size, 1);
    for (const baseUrl of ['javascript:alert(1)', 'http://cashpay-all.com', 'https://user:pass@cashpay-all.com']) assert.throws(() => renderWelcomeContent({ baseUrl }), /public HTTPS/);
});

test('the existing localhost development origin remains compatible while external HTTP origins are refused', () => {
    const mail = renderWelcomeContent({ baseUrl: 'http://localhost:3000', articles: [article(1)] });
    assert.match(mail.html, /href="http:\/\/localhost:3000\/article\.html\?slug=publication-1"/);
    assert.throws(() => renderWelcomeContent({ baseUrl: 'http://external.example.test' }), /public HTTPS/);
});
