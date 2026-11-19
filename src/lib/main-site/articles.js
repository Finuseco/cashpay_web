'use strict';

const { randomBytes } = require('node:crypto');
const MAX_HTML_BYTES = 102400;
const KINDS = new Set(['article', 'communique', 'advertisement']);
const STATUSES = new Set(['draft', 'scheduled', 'published']);
class ArticleError extends Error {
  constructor(status, code, message) { super(message || code); this.name = 'ArticleError'; this.status = status; this.code = code; }
}
const invalid = (message) => { throw new ArticleError(422, 'invalid_article', message); };
const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', colon: ':', tab: '\t', newline: '\n' };
function decodeEntities(value) {
  return String(value).replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);?/gi, (match, entity) => {
    if (entity[0] !== '#') return ENTITIES[entity.toLowerCase()] ?? match;
    const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\ufffd';
  });
}
function safeUrl(value, { image = false, embed = false } = {}) {
  const source = decodeEntities(value).trim();
  if (!source || /[\u0000-\u0020\u007f\\]/.test(source)) return null;
  try {
    const url = new URL(source);
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol) || ((image || embed) && url.protocol !== 'https:')) return null;
    if (embed && !(url.hostname === 'www.youtube.com' && /^\/embed\/[\w-]{6,}$/.test(url.pathname)) && !(url.hostname === 'www.youtube-nocookie.com' && /^\/embed\/[\w-]{6,}$/.test(url.pathname)) && !(url.hostname === 'www.facebook.com' && url.pathname === '/plugins/video.php' && /^https:\/\/(www\.)?facebook\.com\//.test(url.searchParams.get('href') || ''))) return null;
    return url.href;
  } catch { return null; }
}
const ALLOWED_TAGS = new Set('p br h1 h2 h3 h4 h5 h6 strong em b i u s blockquote ul ol li hr a img figure figcaption div span table thead tbody tfoot tr th td iframe'.split(' '));
const VOID_TAGS = new Set(['br', 'hr', 'img']);
const DROP_CONTENT = new Set('script style svg math object template noscript textarea title xmp plaintext noembed form select button'.split(' '));
function safeStyle(value) {
  const declarations = [];
  for (const entry of decodeEntities(value).split(';')) {
    const colon = entry.indexOf(':');
    if (colon < 0) continue;
    const key = entry.slice(0, colon).trim().toLowerCase(), val = entry.slice(colon + 1).trim().toLowerCase();
    if ((key === 'text-align' && /^(left|center|right|justify)$/.test(val)) || (key === 'font-weight' && /^(normal|bold|[1-9]00)$/.test(val)) || (key === 'font-style' && /^(normal|italic)$/.test(val)) || (key === 'text-decoration' && /^(underline|line-through|none)$/.test(val)) || (key === 'font-size' && /^(1[0-9]|[2-6][0-9]|7[0-2])px$/.test(val)) || (['color', 'background-color'].includes(key) && /^(#[\da-f]{3}|#[\da-f]{6}|black|white|red|green|blue|gray|orange|purple)$/.test(val))) declarations.push(key + ':' + val);
  }
  return declarations.join(';');
}
// Parse a deliberately small HTML grammar and serialize a fresh allowlisted tree.
// No source attributes or raw text are copied into executable HTML contexts.
function sanitizeArticleHtml(input) {
  if (typeof input !== 'string' || Buffer.byteLength(input, 'utf8') > MAX_HTML_BYTES) invalid('Le contenu est limité à 100 Ko.');
  const output = [], stack = []; let pos = 0;
  while (pos < input.length) {
    const start = input.indexOf('<', pos);
    if (start < 0) { output.push(escapeHtml(decodeEntities(input.slice(pos)))); break; }
    output.push(escapeHtml(decodeEntities(input.slice(pos, start))));
    if (input.startsWith('<!--', start)) { const end = input.indexOf('-->', start + 4); pos = end < 0 ? input.length : end + 3; continue; }
    let end = start + 1, quote = null;
    for (; end < input.length; end++) {
      const ch = input[end];
      if (quote) { if (ch === quote) quote = null; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '>') break;
      else if (ch === '<') invalid('Le HTML contient une balise mal formée.');
    }
    if (end >= input.length || quote) invalid('Le HTML contient une balise incomplète.');
    const token = input.slice(start + 1, end); pos = end + 1;
    if (/^![^<>]*$/.test(token) || /^\?[^<>]*$/.test(token)) continue;
    const close = /^\/\s*([a-z][a-z0-9:-]*)\s*$/i.exec(token);
    if (close) {
      const tag = close[1].toLowerCase(), index = stack.lastIndexOf(tag);
      if (index >= 0) while (stack.length > index) output.push('</' + stack.pop() + '>');
      continue;
    }
    const open = /^([a-z][a-z0-9:-]*)([\s\S]*)$/i.exec(token);
    if (!open) invalid('Le HTML contient une balise invalide.');
    const tag = open[1].toLowerCase(); let remaining = open[2], selfClose = false;
    if (/\/\s*$/.test(remaining)) { remaining = remaining.replace(/\/\s*$/, ''); selfClose = true; }
    const attrs = new Map();
    while (remaining.length) {
      if (/^\s*$/.test(remaining)) break;
      const attr = /^\s+([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/.exec(remaining);
      if (!attr) invalid('Le HTML contient un attribut mal formé.');
      const name = attr[1].toLowerCase(); if (!attrs.has(name)) attrs.set(name, attr[2] ?? attr[3] ?? attr[4] ?? '');
      remaining = remaining.slice(attr[0].length);
    }
    if (DROP_CONTENT.has(tag)) {
      const closing = new RegExp('<\\/\\s*' + tag + '\\s*>', 'ig'); closing.lastIndex = pos;
      const match = closing.exec(input); pos = match ? closing.lastIndex : input.length; continue;
    }
    if (!ALLOWED_TAGS.has(tag)) continue;
    const clean = [];
    const add = (name, value) => { if (value !== undefined && value !== null && value !== '') clean.push(' ' + name + '="' + escapeHtml(value) + '"'); };
    if (tag !== 'iframe' && attrs.has('title')) add('title', decodeEntities(attrs.get('title')).slice(0, 250));
    if (attrs.has('style')) add('style', safeStyle(attrs.get('style')));
    if (tag === 'a') { add('href', safeUrl(attrs.get('href') || '')); add('rel', 'noopener noreferrer'); }
    if (tag === 'img') {
      const src = safeUrl(attrs.get('src') || '', { image: true }); if (!src) continue;
      add('src', src); add('alt', decodeEntities(attrs.get('alt') || '').slice(0, 250)); add('loading', 'lazy');
    }
    if (tag === 'iframe') {
      const src = safeUrl(attrs.get('src') || '', { embed: true }); if (!src) continue;
      add('src', src); add('title', decodeEntities(attrs.get('title') || 'Vidéo intégrée').slice(0, 250)); add('loading', 'lazy'); add('sandbox', 'allow-scripts allow-same-origin allow-presentation'); add('referrerpolicy', 'strict-origin-when-cross-origin'); add('allowfullscreen', 'true');
    }
    if (['img', 'iframe'].includes(tag)) for (const name of ['width', 'height']) if (/^\d{1,4}$/.test(attrs.get(name) || '')) add(name, String(Math.min(2400, Number(attrs.get(name)))));
    if (['th', 'td'].includes(tag)) for (const name of ['colspan', 'rowspan']) if (/^[1-9]\d?$/.test(attrs.get(name) || '')) add(name, attrs.get(name));
    output.push('<' + tag + clean.join('') + '>');
    if (!VOID_TAGS.has(tag)) { if (selfClose) output.push('</' + tag + '>'); else stack.push(tag); }
  }
  while (stack.length) output.push('</' + stack.pop() + '>');
  const result = output.join('');
  if (Buffer.byteLength(result, 'utf8') > MAX_HTML_BYTES) invalid('Le contenu nettoyé est limité à 100 Ko.');
  return result;
}
function plainText(html) { return decodeEntities(html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|h[1-6]|li|blockquote|div)>/gi, '\n').replace(/<[^>]*>/g, '')).trim(); }
function text(value, name, max, required = false) {
  if (typeof value !== 'string') invalid(name + ' est invalide.');
  const result = value.trim(); if ((required && !result) || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) invalid(name + ' est invalide.'); return result;
}
function slugify(value) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || 'publication-' + randomBytes(6).toString('hex'); }
function validateArticle(input, { previous = null, now = new Date() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Une publication JSON est requise.');
  const value = { ...(previous || {}), ...input };
  const title = text(value.title, 'Le titre', 200, true);
  const slug = value.slug === undefined || value.slug === '' ? slugify(title) : text(value.slug, 'Le lien', 180, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) invalid('Le lien doit contenir des lettres minuscules, chiffres et tirets.');
  const kind = value.kind ?? 'article', status = value.status ?? 'draft';
  if (!KINDS.has(kind) || !STATUSES.has(status)) invalid('Le type ou statut est invalide.');
  const excerpt = text(value.excerpt ?? '', 'Le résumé', 500), coverAlt = text(value.coverAlt ?? '', 'Le texte alternatif', 250);
  let coverUrl = null;
  if (value.coverUrl) { if (typeof value.coverUrl !== 'string' || value.coverUrl.length > 2048 || !(coverUrl = safeUrl(value.coverUrl, { image: true }))) invalid('L’image doit utiliser une URL HTTPS valide.'); }
  const bodyHtml = sanitizeArticleHtml(value.bodyHtml ?? '');
  if (!plainText(bodyHtml) && !/<(?:img|iframe)\b/.test(bodyHtml)) invalid('Le contenu de la publication est requis.');
  if (value.notifySubscribers !== undefined && typeof value.notifySubscribers !== 'boolean') invalid('La notification doit être un booléen.');
  const notifySubscribers = value.notifySubscribers ?? false;
  let publishAt = null;
  if (status === 'scheduled') {
    if (typeof value.publishAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.publishAt)) invalid('Une date ISO avec fuseau horaire est requise.');
    const date = new Date(value.publishAt); if (!Number.isFinite(date.getTime()) || (!previous && date <= now) || (date <= now && (previous?.status !== 'scheduled' || previous.publishAt !== value.publishAt))) invalid('La publication programmée doit être dans le futur.');
    publishAt = date.toISOString();
  } else if (status === 'published') publishAt = previous?.status === 'published' ? previous.publishAt : now.toISOString();
  const publishedAt = previous?.publishedAt || (status === 'published' ? now.toISOString() : null);
  return { title, slug, kind, excerpt, coverUrl, coverAlt, bodyHtml, status, publishAt, publishedAt, notifySubscribers };
}
function iso(value) { return value ? new Date(value).toISOString() : null; }
function mapArticle(row, admin = false, full = false) {
  const article = { id: String(row.id), slug: row.slug, title: row.title, excerpt: row.excerpt, kind: row.kind, coverUrl: row.cover_url || null, coverAlt: row.cover_alt || '', publishedAt: iso(row.published_at || ((row.status === 'scheduled' || row.status === 'published') ? row.publish_at : null)) };
  if (full || admin) article.bodyHtml = row.body_html;
  if (admin) Object.assign(article, { status: row.status, publishAt: iso(row.publish_at), publishedAt: iso(row.published_at), notifySubscribers: row.notify_subscribers, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
  return article;
}
function parsePaging(params, admin) {
  const get = name => typeof params?.get === 'function' ? params.get(name) : params?.[name];
  const parse = (name, fallback, max) => { const raw = get(name); if (raw === undefined || raw === null || raw === '') return fallback; if (!/^\d+$/.test(String(raw)) || Number(raw) > max || (name === 'limit' && Number(raw) < 1)) throw new ArticleError(422, 'invalid_query', 'Pagination invalide.'); return Number(raw); };
  const limit = parse('limit', admin ? 20 : 12, 100), offset = parse('offset', 0, 1000000), kind = get('kind'), status = get('status'), q = get('q');
  if (kind && !KINDS.has(kind)) throw new ArticleError(422, 'invalid_query', 'Type invalide.');
  if (status && (!admin || !STATUSES.has(status))) throw new ArticleError(422, 'invalid_query', 'Statut invalide.');
  if (q && (typeof q !== 'string' || q.length > 200)) throw new ArticleError(422, 'invalid_query', 'Recherche invalide.');
  return { limit, offset, kind, status, q: q?.trim() || '' };
}
const articleId = value => { if (!/^[1-9]\d{0,18}$/.test(String(value))) throw new ArticleError(404, 'article_not_found', 'Publication introuvable.'); return String(value); };
function createArticleService({ db, clock = () => Date.now(), siteOrigin = 'https://cashpay-all.com' } = {}) {
  if (!db?.query || !db?.getConnection) throw new TypeError('An injectable PostgreSQL database is required.');
  const origin = new URL(siteOrigin); if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new TypeError('Invalid public site origin');
  const now = () => new Date(clock());
  async function transaction(work) { const connection = await db.getConnection(); try { await connection.query('BEGIN'); const value = await work(connection); await connection.query('COMMIT'); return value; } catch (error) { try { await connection.query('ROLLBACK'); } catch {} if (error?.code === '23505') throw new ArticleError(409, 'slug_exists', 'Ce lien existe déjà.'); throw error; } finally { connection.release(); } }
  async function list(params, admin) {
    const { limit, offset, kind, status, q } = parsePaging(params, admin), values = [], clauses = [];
    const bind = value => { values.push(value); return '$' + values.length; };
    if (!admin) clauses.push("status IN ('published','scheduled')", 'publish_at <= ' + bind(now().toISOString()));
    if (kind) clauses.push('kind = ' + bind(kind)); if (status) clauses.push('status = ' + bind(status));
    if (q) { const term = bind('%' + q.replace(/[\\%_]/g, '\\$&') + '%'); clauses.push('(title ILIKE ' + term + " ESCAPE '\\' OR excerpt ILIKE " + term + " ESCAPE '\\')"); }
    const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    const fields = admin ? '*' : 'id,slug,title,excerpt,kind,cover_url,cover_alt,published_at,publish_at,status';
    const countValues = values.slice(), countSql = 'SELECT COUNT(*) AS total FROM main_articles' + where;
    const pageSql = 'SELECT ' + fields + ' FROM main_articles' + where + ' ORDER BY ' + (admin ? 'updated_at' : 'publish_at') + ' DESC, id DESC LIMIT ' + bind(limit) + ' OFFSET ' + bind(offset);
    const [page, count] = await Promise.all([db.query(pageSql, values), db.query(countSql, countValues)]);
    return { articles: page.rows.map(row => mapArticle(row, admin)), total: Number(count.rows[0]?.total || 0) };
  }
  async function getPublic(slug) {
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) throw new ArticleError(404, 'article_not_found', 'Publication introuvable.');
    const result = await db.query("SELECT * FROM main_articles WHERE slug=$1 AND status IN ('published','scheduled') AND publish_at <= $2 LIMIT 1", [slug, now().toISOString()]);
    if (!result.rows[0]) throw new ArticleError(404, 'article_not_found', 'Publication introuvable.'); return mapArticle(result.rows[0], false, true);
  }
  async function syncCampaign(connection, article, previous) {
    if (article.status === 'draft' || !article.notifySubscribers) { await connection.query("UPDATE main_newsletter_campaigns SET status='cancelled',updated_at=$2 WHERE article_id=$1 AND status='scheduled'", [article.id, now().toISOString()]); return; }
    const url = new URL('/article.html', origin); url.searchParams.set('slug', article.slug);
    const values = [article.id, article.title, article.bodyHtml, plainText(article.bodyHtml), url.href, article.publishAt, now().toISOString()];
    const mutable = previous && !previous.publishedAt && (previous.status === 'draft' || (previous.status === 'scheduled' && new Date(previous.publishAt) > now()));
    await connection.query("INSERT INTO main_newsletter_campaigns (article_id,subject,body_html,body_text,article_url,status,due_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,'scheduled',$6,$7,$7) ON CONFLICT (article_id) " + (mutable ? "DO UPDATE SET subject=EXCLUDED.subject,body_html=EXCLUDED.body_html,body_text=EXCLUDED.body_text,article_url=EXCLUDED.article_url,status='scheduled',due_at=EXCLUDED.due_at,updated_at=EXCLUDED.updated_at WHERE main_newsletter_campaigns.status IN ('scheduled','cancelled') AND main_newsletter_campaigns.audience_expanded_at IS NULL" : 'DO NOTHING'), values);
  }
  async function create(input, actor) {
    const value = validateArticle(input, { now: now() });
    return transaction(async connection => {
      const result = await connection.query('INSERT INTO main_articles (slug,title,excerpt,kind,cover_url,cover_alt,body_html,status,publish_at,published_at,notify_subscribers,created_by,updated_by,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$13) RETURNING *', [value.slug,value.title,value.excerpt,value.kind,value.coverUrl,value.coverAlt,value.bodyHtml,value.status,value.publishAt,value.publishedAt,value.notifySubscribers,String(actor?.id || actor),now().toISOString()]);
      const article = mapArticle(result.rows[0], true); await syncCampaign(connection, article, null); return article;
    });
  }
  async function update(id, input, actor) {
    id = articleId(id);
    return transaction(async connection => {
      const selected = await connection.query('SELECT * FROM main_articles WHERE id=$1 FOR UPDATE', [id]);
      if (!selected.rows[0]) throw new ArticleError(404, 'article_not_found', 'Publication introuvable.');
      const previous = mapArticle(selected.rows[0], true), value = validateArticle(input, { previous, now: now() });
      const result = await connection.query('UPDATE main_articles SET slug=$2,title=$3,excerpt=$4,kind=$5,cover_url=$6,cover_alt=$7,body_html=$8,status=$9,publish_at=$10,published_at=$11,notify_subscribers=$12,updated_by=$13,updated_at=$14 WHERE id=$1 RETURNING *', [id,value.slug,value.title,value.excerpt,value.kind,value.coverUrl,value.coverAlt,value.bodyHtml,value.status,value.publishAt,value.publishedAt,value.notifySubscribers,String(actor?.id || actor),now().toISOString()]);
      const article = mapArticle(result.rows[0], true); await syncCampaign(connection, article, previous); return article;
    });
  }
  async function getAdmin(id) { const result = await db.query('SELECT * FROM main_articles WHERE id=$1', [articleId(id)]); if (!result.rows[0]) throw new ArticleError(404, 'article_not_found', 'Publication introuvable.'); return mapArticle(result.rows[0], true); }
  async function publishDue(at = now(), limit = 100) {
    const date = new Date(at); if (!Number.isFinite(date.getTime()) || !Number.isInteger(limit) || limit < 1 || limit > 1000) invalid('Paramètres de publication invalides.');
    return transaction(async connection => {
      const result = await connection.query("WITH due AS (SELECT id FROM main_articles WHERE status='scheduled' AND publish_at <= $1 ORDER BY publish_at,id FOR UPDATE SKIP LOCKED LIMIT $2) UPDATE main_articles AS a SET status='published',published_at=COALESCE(a.published_at,a.publish_at),updated_at=$1 FROM due WHERE a.id=due.id RETURNING a.*", [date.toISOString(), limit]);
      for (const row of result.rows) await syncCampaign(connection, mapArticle(row, true), null);
      return result.rows.map(row => mapArticle(row, true));
    });
  }
  return { listPublic: params => list(params, false), listAdmin: params => list(params, true), getPublic, getAdmin, create, update, publishDue };
}
async function readArticleBody(request) {
  const max = 160 * 1024;
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new ArticleError(415, 'json_required', 'Un corps JSON est requis.');
  if (Number(request.headers.get('content-length')) > max) throw new ArticleError(413, 'request_too_large', 'La publication est trop volumineuse.');
  if (!request.body) invalid('Une publication JSON est requise.');
  const reader = request.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new ArticleError(413, 'request_too_large', 'La publication est trop volumineuse.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new ArticleError(422, 'invalid_json', 'Le JSON est invalide.'); }
}
module.exports = { createArticleService, createArticlesService: createArticleService, ArticleError, sanitizeArticleHtml, sanitizeHtml: sanitizeArticleHtml, decodeHtmlEntities: decodeEntities, validateArticle, plainText, safeUrl, readArticleBody, MAX_HTML_BYTES };
