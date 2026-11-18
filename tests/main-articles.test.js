'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createArticleService, sanitizeArticleHtml, validateArticle, plainText, readArticleBody } = require('../src/lib/main-site/articles');

const NOW = Date.parse('2026-11-18T12:00:00.000Z');
const draft = extra => ({ title: 'Annonce CashPay', excerpt: 'Une nouveauté utile.', bodyHtml: '<h2>Bonjour</h2><p>Notre actualité.</p>', kind: 'article', status: 'draft', ...extra });
const row = extra => ({ id: '1', slug: 'annonce-cashpay', title: 'Annonce CashPay', excerpt: 'Une nouveauté utile.', kind: 'article', cover_url: null, cover_alt: '', body_html: '<p>Contenu</p>', status: 'draft', publish_at: null, published_at: null, notify_subscribers: false, created_by: 'admin', updated_by: 'admin', created_at: new Date(NOW), updated_at: new Date(NOW), ...extra });
function fixture({ records = [], failCampaign = false } = {}) {
  const calls = [], state = { records: structuredClone(records), campaigns: [], released: 0 }; let saved;
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql === 'BEGIN') { saved = structuredClone({ records: state.records, campaigns: state.campaigns }); return { rows: [] }; }
    if (sql === 'ROLLBACK') { Object.assign(state, saved); return { rows: [] }; }
    if (sql === 'COMMIT') return { rows: [] };
    if (sql.startsWith('INSERT INTO main_articles')) {
      if (state.records.some(r => r.slug === values[0])) throw Object.assign(new Error('duplicate'), { code: '23505' });
      const r = row({ id: String(state.records.length + 1), slug: values[0], title: values[1], excerpt: values[2], kind: values[3], cover_url: values[4], cover_alt: values[5], body_html: values[6], status: values[7], publish_at: values[8], published_at: values[9], notify_subscribers: values[10], created_by: values[11], updated_by: values[11], created_at: values[12], updated_at: values[12] });
      state.records.push(r); return { rows: [r] };
    }
    if (sql.startsWith('UPDATE main_articles SET')) {
      const r = state.records.find(r => r.id === values[0]);
      Object.assign(r, { slug: values[1], title: values[2], excerpt: values[3], kind: values[4], cover_url: values[5], cover_alt: values[6], body_html: values[7], status: values[8], publish_at: values[9], published_at: values[10], notify_subscribers: values[11], updated_by: values[12], updated_at: values[13] }); return { rows: [r] };
    }
    if (sql.startsWith('INSERT INTO main_newsletter_campaigns')) {
      if (failCampaign) throw new Error('Synthetic enqueue failure');
      const existing = state.campaigns.find(c => c.article_id === values[0]);
      const snapshot = { article_id: values[0], subject: values[1], body_html: values[2], body_text: values[3], article_url: values[4], due_at: values[5], status: 'scheduled', audience_expanded_at: null };
      if (!existing) state.campaigns.push(snapshot);
      else if (sql.includes('DO UPDATE') && ['scheduled', 'cancelled'].includes(existing.status) && !existing.audience_expanded_at) Object.assign(existing, snapshot);
      return { rows: [] };
    }
    if (sql.startsWith('UPDATE main_newsletter_campaigns')) { for (const c of state.campaigns) if (c.article_id === values[0] && c.status === 'scheduled') c.status = 'cancelled'; return { rows: [] }; }
    if (sql.startsWith('SELECT * FROM main_articles WHERE id=')) return { rows: state.records.filter(r => r.id === values[0]) };
    if (sql.startsWith('SELECT * FROM main_articles WHERE slug=')) return { rows: state.records.filter(r => r.slug === values[0] && ['published', 'scheduled'].includes(r.status) && new Date(r.publish_at) <= new Date(values[1])) };
    if (sql.startsWith('WITH due AS')) {
      const due = state.records.filter(r => r.status === 'scheduled' && new Date(r.publish_at) <= new Date(values[0])).slice(0, values[1]);
      for (const r of due) Object.assign(r, { status: 'published', published_at: r.published_at || r.publish_at, updated_at: values[0] }); return { rows: due };
    }
    if (sql.startsWith('SELECT COUNT(*)')) return { rows: [{ total: '17' }] };
    if (sql.startsWith('SELECT id,slug') || sql.startsWith('SELECT * FROM main_articles')) return { rows: state.records.slice(0, values[values.length - 2]) };
    throw new Error('Unexpected SQL: ' + sql);
  };
  const db = { query, async getConnection() { return { query, release() { state.released++; } }; } };
  return { service: createArticleService({ db, clock: () => NOW }), calls, state };
}

test('sanitizer rebuilds content, strips active markup and preserves editorial formatting', () => {
  const html = sanitizeArticleHtml('<h2 onclick="alert(1)">Bonjour &amp; bienvenue</h2><p style="text-align:center;color:#aabbcc;position:fixed;background:url(javascript:1)"><strong>Texte</strong></p><script>alert(1)</script><style>body{display:none}</style><img src="https://images.example.test/cover.jpg" onerror="alert(1)" alt="Couverture">');
  assert.equal(html, '<h2>Bonjour &amp; bienvenue</h2><p style="text-align:center;color:#aabbcc"><strong>Texte</strong></p><img src="https://images.example.test/cover.jpg" alt="Couverture" loading="lazy">');
  assert.equal(sanitizeArticleHtml(html), html);
  assert.equal(plainText('<p>Bonjour &amp; bienvenue</p>'), 'Bonjour & bienvenue');
});

test('encoded protocols, SVG/MathML, raw source attributes, and mutation payloads cannot survive', () => {
  const payloads = [
    '<a href="j&#x61;vascript:alert(1)">x</a>',
    '<a href="javascript&colon;alert(1)">x</a>',
    '<a href="java&#9;script:alert(1)">x</a>',
    '<a href="data:text/html;base64,eA==">x</a>',
    '<img src="data:image/svg+xml,%3Csvg%20onload%3Dalert(1)%3E">',
    '<svg><g onload="alert(1)"></g></svg><math><mtext>x</mtext></math>',
    '<iframe src="https://evil.example.test/" srcdoc="<script>alert(1)</script>"></iframe>',
    '<form><input name="__proto__" value="x"></form>',
    '<p><span style="color:expression(alert(1));background-image:url(javascript:1)">x</span></p>',
    '<img src="https://images.example.test/a.jpg" onerror="alert(1)">',
  ];
  for (const payload of payloads) {
    const html = sanitizeArticleHtml(payload);
    assert.doesNotMatch(html, /javascript|data:|onerror|onload|srcdoc|<script|<svg|<math|<form|expression|evil\.example/i, payload);
    assert.equal(sanitizeArticleHtml(html), html);
  }
  for (const malformed of ['<img src="x" <script>alert(1)</script>', '<a href="x>oops', '<scr<script>ipt>alert(1)']) assert.throws(() => sanitizeArticleHtml(malformed), { status: 422 });
  assert.equal(sanitizeArticleHtml('&lt;img src=x onerror=alert(1)&gt;'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('only HTTPS YouTube and Facebook embed endpoints are allowed', () => {
  const html = sanitizeArticleHtml('<iframe src="https://www.youtube-nocookie.com/embed/abc123def45" title="Présentation" allow="camera;microphone"></iframe>');
  assert.match(html, /sandbox="allow-scripts allow-same-origin allow-presentation"/);
  assert.doesNotMatch(html, /camera|microphone/);
  for (const src of ['http://www.youtube.com/embed/abc123def45','https://www.youtube.com.evil.test/embed/abc123def45','https://user:pass@www.youtube.com/embed/abc123def45','https://www.youtube.com/redirect?q=evil']) assert.equal(sanitizeArticleHtml(`<iframe src="${src}"></iframe>`), '');
});

test('publication validation enforces kind, status, HTTPS covers, content limits and explicit schedule timezone', () => {
  const good = validateArticle(draft({ title: 'Économie & Finance', coverUrl: 'https://images.example.test/a.png' }), { now: new Date(NOW) });
  assert.equal(good.slug, 'economie-finance'); assert.equal(good.status, 'draft'); assert.equal(good.notifySubscribers, false);
  for (const bad of [{ kind: 'script' }, { status: 'archived' }, { title: '' }, { slug: '../bad' }, { coverUrl: 'javascript:alert(1)' }, { coverUrl: 'http://images.example.test/a.png' }, { notifySubscribers: 'true' }, { bodyHtml: '<p>' + 'a'.repeat(102401) + '</p>' }, { status: 'scheduled', publishAt: '2026-11-19T12:00' }, { status: 'scheduled', publishAt: '2026-11-18T11:00:00Z' }]) assert.throws(() => validateArticle(draft(bad), { now: new Date(NOW) }), { status: 422 });
  const scheduled = validateArticle(draft({ status: 'scheduled', publishAt: '2026-11-19T15:00:00+02:00' }), { now: new Date(NOW) });
  assert.equal(scheduled.publishAt, '2026-11-19T13:00:00.000Z');
});

test('publish stores sanitized content and enqueues exactly one immutable newsletter snapshot in the same transaction', async () => {
  const f = fixture();
  const article = await f.service.create(draft({ status: 'published', notifySubscribers: true, bodyHtml: '<p onclick="x">Version 1</p><script>evil</script>' }), { id: '42' });
  assert.equal(article.bodyHtml, '<p>Version 1</p>'); assert.equal(article.publishedAt, new Date(NOW).toISOString());
  assert.equal(f.state.campaigns.length, 1); assert.equal(f.state.campaigns[0].body_html, '<p>Version 1</p>');
  assert.equal(f.state.campaigns[0].article_url, 'https://cashpay-all.com/article.html?slug=annonce-cashpay');
  assert.equal(f.calls[0].sql, 'BEGIN'); assert.equal(f.calls.at(-1).sql, 'COMMIT');
  await f.service.update(article.id, { bodyHtml: '<p>Version 2</p>' }, { id: '42' });
  assert.equal(f.state.records[0].body_html, '<p>Version 2</p>'); assert.equal(f.state.campaigns.length, 1); assert.equal(f.state.campaigns[0].body_html, '<p>Version 1</p>'); assert.equal(f.state.released, 2);
});

test('newsletter enqueue failure rolls back article and releases its dedicated PostgreSQL connection', async () => {
  const f = fixture({ failCampaign: true });
  await assert.rejects(f.service.create(draft({ status: 'published', notifySubscribers: true }), '42'), /Synthetic enqueue/);
  assert.deepEqual(f.state.records, []); assert.deepEqual(f.state.campaigns, []); assert.equal(f.calls.at(-1).sql, 'ROLLBACK'); assert.equal(f.state.released, 1);
});

test('draft has no newsletter, scheduled snapshot follows edits, and withdrawal cancels its pending campaign', async () => {
  const f = fixture();
  const article = await f.service.create(draft({ notifySubscribers: true }), '42'); assert.equal(f.state.campaigns.length, 0);
  await f.service.update(article.id, { status: 'scheduled', publishAt: '2026-11-19T12:00:00Z' }, '42'); assert.equal(f.state.campaigns.length, 1);
  await f.service.update(article.id, { bodyHtml: '<p>Programme final</p>' }, '42'); assert.equal(f.state.campaigns[0].body_html, '<p>Programme final</p>');
  await f.service.update(article.id, { status: 'draft' }, '42'); assert.equal(f.state.campaigns[0].status, 'cancelled');
});

test('public detail denies drafts and future schedules and exposes due schedules without relying on cron', async () => {
  const f = fixture({ records: [row(), row({ id: '2', slug: 'futur', status: 'scheduled', publish_at: '2026-11-19T12:00:00Z' }), row({ id: '3', slug: 'disponible', status: 'scheduled', publish_at: '2026-11-18T11:00:00Z' })] });
  await assert.rejects(f.service.getPublic('annonce-cashpay'), { status: 404 }); await assert.rejects(f.service.getPublic('futur'), { status: 404 });
  const article = await f.service.getPublic('disponible'); assert.equal(article.publishedAt, '2026-11-18T11:00:00.000Z'); assert.equal(article.bodyHtml, '<p>Contenu</p>'); assert.equal(article.status, undefined);
});

test('public feed binds filters, limits to one, and omits bodies while returning total', async () => {
  const f = fixture({ records: [row({ status: 'published', publish_at: '2026-11-18T11:00:00Z' })] });
  const result = await f.service.listPublic(new URLSearchParams('limit=1&offset=2&kind=article&q=50%25_cash'));
  assert.equal(result.total, 17); assert.equal(result.articles[0].bodyHtml, undefined);
  const query = f.calls.find(c => c.sql.startsWith('SELECT id,slug'));
  assert.doesNotMatch(query.sql, /body_html|50%|_cash/); assert.match(query.sql, /status IN \('published','scheduled'\)/); assert.match(query.sql, /publish_at <= \$1/); assert.deepEqual(query.values.slice(-2), [1, 2]); assert.ok(query.values.includes('%50\\%\\_cash%'));
  for (const params of [{ limit: '0' }, { limit: '10000' }, { offset: '-1' }, { limit: '1;DROP TABLE main_articles' }, { kind: 'unknown' }]) await assert.rejects(f.service.listPublic(params), { status: 422 });
});

test('cron promotion uses row locks, preserves schedule publication time and enqueues missing campaign once', async () => {
  const f = fixture({ records: [row({ status: 'scheduled', publish_at: '2026-11-18T11:00:00Z', notify_subscribers: true })] });
  const articles = await f.service.publishDue(); assert.equal(articles.length, 1); assert.equal(articles[0].status, 'published'); assert.equal(articles[0].publishedAt, '2026-11-18T11:00:00.000Z'); assert.equal(f.state.campaigns.length, 1);
  assert.match(f.calls.find(c => c.sql.startsWith('WITH due')).sql, /FOR UPDATE SKIP LOCKED/);
  await f.service.publishDue(); assert.equal(f.state.campaigns.length, 1);
});

test('slug conflicts return a useful conflict without exposing raw database errors', async () => {
  const f = fixture({ records: [row()] });
  await assert.rejects(f.service.create(draft(), '42'), { status: 409, code: 'slug_exists' }); assert.equal(f.state.records.length, 1); assert.equal(f.calls.at(-1).sql, 'ROLLBACK');
});

test('bounded JSON parser rejects invalid or oversized bodies before article processing', async () => {
  const request = value => new Request('https://app.cashpay-all.com/api/main/admin/articles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: value });
  assert.deepEqual(await readArticleBody(request('{"title":"Test"}')), { title: 'Test' });
  await assert.rejects(readArticleBody(request('{')), { status: 422 });
  await assert.rejects(readArticleBody(request('x'.repeat(165000))), { status: 413 });
  await assert.rejects(readArticleBody(new Request('https://app.cashpay-all.com', { method: 'POST', body: 'x' })), { status: 415 });
});
