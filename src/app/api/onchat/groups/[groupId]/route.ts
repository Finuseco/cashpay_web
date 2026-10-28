'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getGroupWithMessages } from '@/lib/actions/group.actions';

export async function GET(request: NextRequest, { params }: { params: { groupId: string } }) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const groupId = parseInt(params.groupId, 10);
        if (isNaN(groupId)) {
            return NextResponse.json({ success: false, error: 'Invalid group ID.' }, { status: 400 });
        }

        const group = await getGroupWithMessages(groupId, user.id);

        if (group) {
            return NextResponse.json({ success: true, group });
        } else {
            return NextResponse.json({ success: false, error: 'Group not found or you are not a member.' }, { status: 404 });
        }

    } catch (error) {
        console.error('[API OnChat GET Group] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: { groupId: string } }) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        const groupId = Number(params.groupId);
        if (!Number.isSafeInteger(groupId) || groupId <= 0) return NextResponse.json({ success: false, error: 'Groupe invalide.' }, { status: 400 });
        const body = await request.json();
        const { ownedAttachmentPath } = await import('@/lib/chat-attachments');
        const type = typeof body.type === 'string' ? body.type : 'text';
        if (!['text', 'image', 'audio', 'video', 'doc', 'meeting', 'sticker', 'contact', 'location', 'poll', 'product'].includes(type)) return NextResponse.json({ success: false, error: 'Type invalide.' }, { status: 400 });
        const content = typeof body.content === 'string' ? body.content : '';
        const fileUrl = typeof body.fileUrl === 'string' ? ownedAttachmentPath(body.fileUrl, user.id) : null;
        if (body.fileUrl && !fileUrl) return NextResponse.json({ success: false, error: 'Fichier non autorisé.' }, { status: 400 });
        if (!content.trim() && !fileUrl) return NextResponse.json({ success: false, error: 'Message requis.' }, { status: 400 });
        const { postGroupMessage } = await import('@/lib/actions/message.actions');
        const message = await postGroupMessage(groupId, user.id, content, type as any, undefined, undefined, fileUrl ? { fileUrl, fileName: String(body.fileName || 'Fichier') } : undefined);
        return NextResponse.json({ success: true, message: { ...message, metadata: message.metadata ? JSON.parse(message.metadata) : null } }, { status: 201 });
    } catch (error) { return NextResponse.json({ success: false, error: 'Envoi au groupe refusé ou indisponible.' }, { status: 400 }); }
}
