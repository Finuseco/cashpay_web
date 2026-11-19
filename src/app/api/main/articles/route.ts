import { getArticleService } from '@/lib/main-site/runtime';
import { json, preflight, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) { return preflight(request); }
export async function GET(request: Request) {
  try {
    const result = await getArticleService().listPublic(new URL(request.url).searchParams);
    return json(request, 200, { ok: true, ...result });
  } catch (error: any) {
    return failure(request, error);
  }
}
