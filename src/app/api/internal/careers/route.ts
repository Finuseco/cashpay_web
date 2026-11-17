import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/services/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Suivi des candidatures (table career_applications, voir migrations/20261117_career_applications.sql).
 * Protégé par l'en-tête x-internal-job-secret (variable INTERNAL_JOB_SECRET), comme les autres routes internes.
 *
 *  GET   /api/internal/careers?status=received&position=manager&q=dupont&limit=50&offset=0   → liste
 *  PATCH /api/internal/careers  { "ref": "CP-…", "status": "interview", "notify": true, "note": "…" }
 *        → change le statut et, si notify=true, envoie l'e-mail « résultat » au candidat (journalisé).
 */
const STATUSES = ['received', 'reviewing', 'shortlisted', 'interview', 'accepted', 'rejected'] as const;
const LABELS: Record<string, { fr: string; title: string; message: string }> = {
  received: { fr: 'Reçue', title: 'Candidature reçue', message: 'Votre candidature a bien été reçue.' },
  reviewing: { fr: 'En cours d\'étude', title: 'Candidature en cours d\'étude', message: 'Notre équipe étudie actuellement votre dossier.' },
  shortlisted: { fr: 'Présélectionnée', title: 'Vous êtes présélectionné(e)', message: 'Bonne nouvelle : votre profil a retenu notre attention et votre candidature est présélectionnée. Nous reviendrons vers vous très prochainement.' },
  interview: { fr: 'Entretien', title: 'Invitation à un entretien', message: 'Nous souhaitons vous rencontrer. Notre équipe vous contactera par téléphone ou par e-mail pour fixer la date de l\'entretien.' },
  accepted: { fr: 'Acceptée', title: 'Félicitations, candidature retenue', message: 'Nous avons le plaisir de vous informer que votre candidature est retenue. Notre équipe vous contactera pour les prochaines étapes.' },
  rejected: { fr: 'Non retenue', title: 'Suite donnée à votre candidature', message: 'Nous vous remercions de l\'intérêt porté à CashPay All. Après étude de votre dossier, nous ne pouvons malheureusement pas donner suite pour ce poste. Nous conservons votre candidature et vous encourageons à postuler à nouveau.' },
};

function authorized(request: NextRequest) {
  const expected = process.env.INTERNAL_JOB_SECRET;
  if (!expected) return false;
  const provided = request.headers.get('x-internal-job-secret');
  return !!provided && provided === expected;
}
const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  const sp = request.nextUrl.searchParams;
  const where: string[] = []; const params: any[] = [];
  const status = sp.get('status'); if (status && (STATUSES as readonly string[]).includes(status)) { params.push(status); where.push(`status = $${params.length}`); }
  const position = sp.get('position'); if (position) { params.push(position); where.push(`position = $${params.length}`); }
  const q = sp.get('q'); if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`(LOWER(last_name) LIKE $${params.length} OR LOWER(first_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR ref ILIKE $${params.length})`); }
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
  params.push(limit, offset);
  try {
    const rows = await db.query(
      `SELECT id, ref, created_at, country, province, position, position_label, last_name, first_name, gender, age, profession, phone, email, city, status, status_updated_at, result_notified_at,
              (SELECT COUNT(*) FROM career_email_log l WHERE l.application_id = a.id AND NOT l.ok) AS mail_failures
         FROM career_applications a ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return NextResponse.json({ success: true, count: rows.rowCount, applications: rows.rows });
  } catch (e: any) {
    console.error('[careers] list failed:', e);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  let body: any; try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }
  const ref = String(body?.ref || ''); const status = String(body?.status || '');
  if (!ref || !(STATUSES as readonly string[]).includes(status)) return NextResponse.json({ success: false, error: 'ref and valid status required' }, { status: 400 });
  try {
    const upd = await db.query(
      `UPDATE career_applications SET status = $2, status_updated_at = NOW(), notes = COALESCE(NULLIF($3, ''), notes) WHERE ref = $1
       RETURNING id, ref, email, first_name, COALESCE(position_label, position) AS position, lang`, [ref, status, String(body?.note || '').slice(0, 2000)]);
    if (!upd.rowCount) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    const a = upd.rows[0]; let notified = false; let mailError: string | null = null;
    if (body?.notify === true) {
      const L = LABELS[status];
      const r = await sendEmail(a.email, `${L.title} — ${a.ref}`, 'career_status', { title: L.title, firstName: a.first_name, message: L.message, ref: a.ref, position: a.position, statusLabel: L.fr });
      notified = r.success; if (!r.success) mailError = r.message;
      await db.query(`INSERT INTO career_email_log (application_id, kind, to_email, ok, error) VALUES ($1,'result',$2,$3,$4)`, [a.id, a.email, r.success, mailError]);
      if (r.success) await db.query(`UPDATE career_applications SET result_notified_at = NOW() WHERE id = $1`, [a.id]);
    }
    return NextResponse.json({ success: true, ref: a.ref, status, notified, mailError });
  } catch (e: any) {
    console.error('[careers] update failed:', e);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }
}
