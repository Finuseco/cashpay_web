import { requireMainAdmin } from '@/lib/main-site/auth';
import { getDeliveryService } from '@/lib/main-site/runtime';
import { json, preflight, failure } from '@/lib/main-site/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;
export async function GET(request: Request) {
    try {
        await requireMainAdmin(request);
        return json(request, 200, await getDeliveryService().listCampaigns());
    } catch (error) { return failure(request, error); }
}
