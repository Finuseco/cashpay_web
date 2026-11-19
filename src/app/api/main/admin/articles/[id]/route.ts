import { getArticleService } from '@/lib/main-site/runtime';
import { requireMainAdmin } from '@/lib/main-site/auth';
import { json, preflight, requireOrigin, readJson, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: { id: string } };

export function OPTIONS(request: Request) { return preflight(request); }
export async function GET(request: Request, { params }: Context) {
  try {
    requireOrigin(request);
    await requireMainAdmin(request);
    return json(request, 200, { ok: true, article: await getArticleService().getAdmin(params.id) });
  } catch (error: any) { return failure(request, error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    requireOrigin(request);
    const admin = await requireMainAdmin(request);
    const article = await getArticleService().update(params.id, await readJson(request), admin);
    return json(request, 200, { ok: true, article });
  } catch (error: any) { return failure(request, error); }
}
