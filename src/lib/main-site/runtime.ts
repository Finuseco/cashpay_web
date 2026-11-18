import { db } from '@/lib/db';
import { createArticleService, sanitizeArticleHtml } from './articles.js';
import { createNewsletterService } from './newsletter.js';
import { createDeliveryService, createStrictMailer } from './delivery.js';
import { createContactsService } from './contacts.js';

// Each service uses the existing Next process and PostgreSQL pool. No extra
// Main server, document store, or credentials in the static frontend.
const siteOrigin = () => process.env.MAIN_SITE_URL || 'https://cashpay-all.com';
let articles: ReturnType<typeof createArticleService>;
let newsletter: ReturnType<typeof createNewsletterService>;
let delivery: ReturnType<typeof createDeliveryService>;
let contacts: ReturnType<typeof createContactsService>;
let mailer: ReturnType<typeof createStrictMailer>;
const sendMail = (message: any) => {
  mailer ||= createStrictMailer(process.env);
  return mailer(message);
};
export function getArticleService() {
  articles ||= createArticleService({ db, siteOrigin: siteOrigin() });
  return articles;
}
export function getNewsletterService() {
  newsletter ||= createNewsletterService({ db, sendMail, baseUrl: siteOrigin(), tokenSecret: process.env.MAIN_NEWSLETTER_TOKEN_SECRET });
  return newsletter;
}
export function getDeliveryService() {
  delivery ||= createDeliveryService({ db, sendMail, baseUrl: siteOrigin(), tokenSecret: process.env.MAIN_NEWSLETTER_TOKEN_SECRET, sanitizeHtml: sanitizeArticleHtml });
  return delivery;
}
export function getContactsService() {
  contacts ||= createContactsService({ db, sendMail });
  return contacts;
}
export async function recordSubmissionContact(contact: { ref: string; kind: 'careers' | 'project'; email: string }) {
  return getContactsService().record(contact);
}
export async function dispatchMainJobs() {
  // Expired authentication capabilities have no editorial value. Retain a day
  // for operational diagnosis, then prune them without touching wallet data.
  await db.query("DELETE FROM main_auth_challenges WHERE expires_at < NOW() - INTERVAL '1 day'");
  await db.query("DELETE FROM main_auth_sessions WHERE expires_at < NOW() - INTERVAL '1 day'");
  const published = await getArticleService().publishDue();
  const replies = await getContactsService().dispatchDueReplies({ limit: 5, budgetMs: 20000 });
  const newsletters = await getDeliveryService().dispatchDue({ limit: 10, budgetMs: 20000 });
  return { published: published.length, replies, newsletters };
}
