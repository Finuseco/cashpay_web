import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { likeActivity } from '@/lib/actions/monpays.actions';

export async function POST(_request: Request, { params }: { params: { postId: string } }) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const result = await likeActivity(params.postId, user.id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
