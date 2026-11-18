import { getNewsletterService } from '@/lib/main-site/runtime';
import { json, preflight, requireOrigin, readJson, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;
export async function POST(request: Request) {
    try {
        requireOrigin(request);
        const input = await readJson(request, 4096);
        const forwarded = process.env.MAIN_TRUST_PROXY === '1' ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() : undefined;
        return json(request, 200, await getNewsletterService().subscribe(input, { ip: forwarded || 'unknown' }));
    } catch (error) { return failure(request, error); }
}
