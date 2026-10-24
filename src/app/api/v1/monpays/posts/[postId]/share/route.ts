import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { initiateTrackedShare } from '@/lib/actions/monpays.actions';

/** Génère (ou retrouve) mon lien de partage suivi : { platform }. 5 clics uniques = récompense. */
export async function POST(request: Request, { params }: { params: { postId: string } }) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const platform = typeof body.platform === 'string' && body.platform ? body.platform.slice(0, 30) : 'link';
    const result = await initiateTrackedShare(params.postId, user.id, platform);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
