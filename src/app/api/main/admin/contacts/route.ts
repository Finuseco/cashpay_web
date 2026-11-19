import { getContactsService } from '@/lib/main-site/runtime';
import { requireMainAdmin } from '@/lib/main-site/auth';
import { json, preflight, requireOrigin, readJson, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function OPTIONS(request: Request) { return preflight(request); }
export async function GET(request: Request) {
  try {
    requireOrigin(request); await requireMainAdmin(request);
    return json(request, 200, { ok: true, ...await getContactsService().list(new URL(request.url).searchParams) });
  } catch (error: any) { return failure(request, error); }
}
