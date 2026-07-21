'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { updateMessage, deleteMessage, getMessageById } from '@/lib/actions/message.actions';
import { z } from 'zod';

const messageUpdateSchema = z.object({
  content: z.string().min(1, "Le contenu ne peut pas être vide."),
});

export async function PUT(request: NextRequest, { params }: { params: { messageId: string } }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const messageId = params.messageId;
    const message = await getMessageById(messageId);
    if (!message || message.senderId !== user.id) {
        return NextResponse.json({ success: false, error: 'Message non trouvé ou accès non autorisé.' }, { status: 404 });
    }

    const body = await request.json();
    const validation = messageUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Invalid data', details: validation.error.flatten() }, { status: 400 });
    }

    const result = await updateMessage(messageId, validation.data.content);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

  } catch (error) {
    console.error('[API OnChat PUT Message] Error:', error);
    return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { messageId: string } }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const messageId = params.messageId;
    const message = await getMessageById(messageId);
    if (!message || message.senderId !== user.id) {
        return NextResponse.json({ success: false, error: 'Message non trouvé ou accès non autorisé.' }, { status: 404 });
    }

    const result = await deleteMessage(messageId);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('[API OnChat DELETE Message] Error:', error);
    return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
  }
}
