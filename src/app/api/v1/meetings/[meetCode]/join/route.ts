import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { admitMeeting, MeetingAccessError } from '@/lib/meeting-access';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, { params }: { params: { meetCode: string } }) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        const body = await request.json().catch(() => ({}));
        return NextResponse.json(await admitMeeting(params.meetCode, user, body));
    } catch (error) {
        if (error instanceof MeetingAccessError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
        console.error('[OnChat admission]', error);
        return NextResponse.json({ success: false, error: 'Admission indisponible. Aucun paiement ni accès confirmé.' }, { status: 503 });
    }
}
