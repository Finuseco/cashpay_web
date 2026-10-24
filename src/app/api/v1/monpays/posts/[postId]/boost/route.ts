import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { boostActivity } from '@/lib/actions/monpays.actions';

/** Booster ma publication (budget de récompenses de partage) : { amount, pin }. */
export async function POST(request: Request, { params }: { params: { postId: string } }) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}$/.test(String(body.pin || ''))) {
        return NextResponse.json({ success: false, error: 'Montant et PIN requis.' }, { status: 400 });
    }
    const result = await boostActivity(params.postId, user.id, amount, String(body.pin));
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
