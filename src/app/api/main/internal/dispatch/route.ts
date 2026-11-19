import { timingSafeEqual } from 'node:crypto';
import { dispatchMainJobs } from '@/lib/main-site/runtime';
import { json, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
    try {
        const secret = process.env.INTERNAL_JOB_SECRET;
        const authorization = request.headers.get('authorization') || '';
        const expected = secret ? `Bearer ${secret}` : '';
        const actualBytes = Buffer.from(authorization);
        const expectedBytes = Buffer.from(expected);
        if (!secret || secret.length < 32 || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
            return json(request, 401, { ok: false, error: 'job_auth_required', message: 'Authentification requise.' });
        }
        // Never accept secrets in a URL, invoke work on GET, or schedule detached timers.
        return json(request, 200, { ok: true, ...await dispatchMainJobs() });
    } catch (error) { return failure(request, error); }
}
