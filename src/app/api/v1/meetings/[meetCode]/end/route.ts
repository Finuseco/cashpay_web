import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { controlMeeting } from '@/lib/meeting-control';
import { MeetingAccessError } from '@/lib/meeting-access';
export async function POST(request: Request, { params }: { params: { meetCode: string } }) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        const body = await request.json().catch(() => ({}));

        return NextResponse.json(await controlMeeting(params.meetCode, user.id, 'end', undefined, false));
    } catch (error) {
        if (error instanceof MeetingAccessError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
        return NextResponse.json({ success: false, error: 'Action indisponible.' }, { status: 503 });
    }
}
