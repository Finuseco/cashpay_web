import { getArticleService } from '@/lib/main-site/runtime';
import { json, preflight, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) { return preflight(request); }
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    return json(request, 200, { ok: true, article: await getArticleService().getPublic(params.slug) });
  } catch (error: any) {
    return failure(request, error);
  }
}
