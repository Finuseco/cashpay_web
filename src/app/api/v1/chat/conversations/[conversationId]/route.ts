import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { db } from '@/lib/db';
import type { Message } from '@/lib/types';
import { ownedAttachmentPath, parseChatDataUri } from '@/lib/chat-attachments';
import { postMessage } from '@/lib/actions/message.actions';

export async function GET(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  let connection;

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const conversationId = params.conversationId;

    connection = await db.getConnection();

    const { rows: accessRows } = await connection.query(
      `
      SELECT 1
      FROM conversation_participants
      WHERE conversation_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [conversationId, user.id]
    );

    if (accessRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Conversation non trouvée ou accès non autorisé.',
        },
        { status: 404 }
      );
    }

    const { rows: contactRows } = await connection.query(
      `
      SELECT
        u.id,
        u.id_wallet AS "walletId",
        u.full_name AS "fullName",
        u.phone,
        u.profile_photo AS "profilePhoto",
        u.availabilitystatus AS "availabilityStatus"
      FROM conversation_participants cp
      INNER JOIN users u
        ON u.id = cp.user_id
      WHERE cp.conversation_id = $1
        AND cp.user_id <> $2
      ORDER BY u.id
      LIMIT 1
      `,
      [conversationId, user.id]
    );

    const { rows: messageRows } = await connection.query(
      `
      SELECT
        id,
        conversation_id AS "conversationId",
        sender_id AS "senderId",
        content,
        type,
        metadata,
        status,
        is_read AS "isRead",
        created_at AS "createdAt",
        image_id AS "imageId"
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [conversationId]
    );

    return NextResponse.json({
      success: true,

      conversation: {
        id: conversationId,

        contact: contactRows[0] || null,

        messages: messageRows.map((message) => ({
          id: String(message.id),
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          metadata: typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata,
          status: message.status,
          isRead: message.isRead,
          imageId: message.imageId,
          timestamp: new Date(message.createdAt).toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('[API V1 CHAT CONVERSATION GET]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de récupérer la conversation.',
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

export async function POST(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const conversationId = params.conversationId;
    const body = await request.json();

    const content = typeof body.content === 'string'
      ? body.content
      : '';

    const type = typeof body.type === 'string'
      ? body.type as Message['type']
      : 'text';

    const fileDataUri =
      typeof body.fileDataUri === 'string'
        ? body.fileDataUri
        : undefined;

    const fileName =
      typeof body.fileName === 'string'
        ? body.fileName
        : undefined;

    if (fileDataUri) {
      try { parseChatDataUri(fileDataUri); } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
      }
    }
    const fileUrl = typeof body.fileUrl === 'string' ? ownedAttachmentPath(body.fileUrl, user.id) : null;
    if (body.fileUrl && !fileUrl) return NextResponse.json({ success: false, error: 'Fichier non autorisé.' }, { status: 400 });
    if (!['text', 'image', 'audio', 'video', 'doc', 'sticker', 'location', 'contact', 'poll', 'meeting', 'product'].includes(type)) return NextResponse.json({ success: false, error: 'Type de message invalide.' }, { status: 400 });
    const metadata: Record<string, string> = {};
    const metadataKeys = ['duration', 'durationSeconds', 'mimeType', 'fileSize', 'width', 'height', 'meetCode'];
    if (body.metadata && typeof body.metadata === 'object') {
      for (const key of metadataKeys) {
        const value = body.metadata[key];
        if (typeof value === 'string' && value.length <= 512) metadata[key] = value;
      }
    }
    if (fileUrl) Object.assign(metadata, { fileUrl, fileName: fileName || 'Pièce jointe' });
    const attachmentMetadata = Object.keys(metadata).length ? metadata : undefined;
    // No transaction spans this lookup; release the pool slot before postMessage opens its transaction.
      const { rows: participantRows } = await db.query(
        `
        SELECT user_id
        FROM conversation_participants
        WHERE conversation_id = $1
        ORDER BY user_id
        `,
        [conversationId]
      );

      if (participantRows.length !== 2) {
        return NextResponse.json(
          {
            success: false,
            error: 'Conversation introuvable ou invalide.',
          },
          { status: 404 }
        );
      }

      const participantIds = participantRows.map((row) =>
        Number(row.user_id)
      );

      if (!participantIds.includes(user.id)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Accès non autorisé à cette conversation.',
          },
          { status: 403 }
        );
      }

      const receiverId = participantIds.find(
        (participantId) => participantId !== user.id
      );

      if (!receiverId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Correspondant introuvable.',
          },
          { status: 404 }
        );
      }

      if (!content.trim() && !fileDataUri && !fileUrl) {
        return NextResponse.json(
          {
            success: false,
            error: 'Le message ou le fichier est requis.',
          },
          { status: 400 }
        );
      }

      const message = await postMessage(
        conversationId,
        content,
        type,
        user.id,
        receiverId,
        fileDataUri,
        fileName,
        attachmentMetadata
      );

      return NextResponse.json(
        {
          success: true,
          message: { ...message, metadata: message.metadata ? JSON.parse(message.metadata) : null },
        },
        { status: 201 }
      );
  } catch (error) {
    console.error('[API V1 CHAT MESSAGE POST]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible d’envoyer le message.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  let connection;

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const conversationId = params.conversationId;

    connection = await db.getConnection();

    await connection.query('BEGIN');

    const { rows: participantRows } = await connection.query(
      `
      SELECT 1
      FROM conversation_participants
      WHERE conversation_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [conversationId, user.id]
    );

    if (participantRows.length === 0) {
      await connection.query('ROLLBACK');

      return NextResponse.json(
        {
          success: false,
          error: 'Conversation non trouvée ou accès non autorisé.',
        },
        { status: 404 }
      );
    }

    /*
     * Cascade applicative :
     *
     * conversation
     *    ├── messages
     *    ├── conversation_participants
     *    └── conversation
     *
     * Tout est effectué dans une seule transaction.
     */

    await connection.query(
      `
      DELETE FROM messages
      WHERE conversation_id = $1
      `,
      [conversationId]
    );

    await connection.query(
      `
      DELETE FROM conversation_participants
      WHERE conversation_id = $1
      `,
      [conversationId]
    );

    const result = await connection.query(
      `
      DELETE FROM conversations
      WHERE id = $1
      `,
      [conversationId]
    );

    if (!result.rowCount) {
      await connection.query('ROLLBACK');

      return NextResponse.json(
        {
          success: false,
          error: 'Conversation introuvable.',
        },
        { status: 404 }
      );
    }

    await connection.query('COMMIT');

    return NextResponse.json({
      success: true,
      conversationId,
      deleted: true,
    });
  } catch (error) {
    if (connection) {
      await connection.query('ROLLBACK');
    }

    console.error('[API V1 CHAT CONVERSATION DELETE]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de supprimer la conversation.',
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
