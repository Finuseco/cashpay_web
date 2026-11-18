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
    if (input.status !== 'cancelled') return json(request, 422, { ok: false, error: 'invalid_status', message: 'Seule une réponse en attente peut être annulée.' });
    const reply = await getContactsService().cancelReply(params.id);
    return json(request, 200, { ok: true, reply });
  } catch (error: any) { return failure(request, error); }
}
