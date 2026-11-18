import { getArticleService } from '@/lib/main-site/runtime';
import { requireMainAdmin } from '@/lib/main-site/auth';
import { json, preflight, requireOrigin, readJson, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) { return preflight(request); }
export async function GET(request: Request) {
  try {
    requireOrigin(request);
    await requireMainAdmin(request);
    return json(request, 200, { ok: true, ...await getArticleService().listAdmin(new URL(request.url).searchParams) });
  } catch (error: any) { return failure(request, error); }
}
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const admin = await requireMainAdmin(request);
    const article = await getArticleService().create(await readJson(request), admin);
    return json(request, 201, { ok: true, article });
  } catch (error: any) { return failure(request, error); }
}
