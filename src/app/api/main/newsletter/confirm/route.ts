import { getNewsletterService } from '@/lib/main-site/runtime';
import { json, preflight, requireOrigin, readJson, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;
export async function POST(request: Request) {
    try {
        requireOrigin(request);
        const input = await readJson(request, 4096);
        return json(request, 200, await getNewsletterService().confirm(input.token));
    } catch (error) { return failure(request, error); }
}
