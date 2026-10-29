import { NextResponse } from 'next/server';
import { soundForVideo } from '@/lib/video-sounds';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: { id: string } }) {
    if (!await getAuthenticatedUser()) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ success: false, error: 'Vidéo invalide.' }, { status: 400 });
    try {
        const sound = await soundForVideo(id);
        return NextResponse.json({ success: true, sound });
    } catch { return NextResponse.json({ success: false, error: 'Catalogue audio indisponible. Vérifiez la migration des sons OnChat.' }, { status: 503 }); }
}
