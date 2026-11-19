import { getContactsService } from '@/lib/main-site/runtime';
import { requireMainAdmin } from '@/lib/main-site/auth';
import { json, preflight, requireOrigin, readJson, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function OPTIONS(request: Request) { return preflight(request); }
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    requireOrigin(request); await requireMainAdmin(request);
    const input = await readJson(request, 4096);
    const contact = await getContactsService().setStatus(params.id, input.status);
    return json(request, 200, { ok: true, contact });
  } catch (error: any) { return failure(request, error); }
}
