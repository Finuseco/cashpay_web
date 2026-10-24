import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createMonPaysActivity } from '@/lib/actions/monpays.actions';

/** Publier au nom de ma page : { content, imageDataUrl? } (le propriétaire est vérifié côté serveur). */
export async function POST(request: Request, { params }: { params: { companyId: string } }) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const companyId = parseInt(params.companyId, 10);
    if (!Number.isInteger(companyId)) return NextResponse.json({ success: false, error: 'Page invalide.' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const result = await createMonPaysActivity(
        companyId,
        user.id,
        typeof body.content === 'string' ? body.content : '',
        typeof body.imageDataUrl === 'string' ? body.imageDataUrl : null
    );
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
