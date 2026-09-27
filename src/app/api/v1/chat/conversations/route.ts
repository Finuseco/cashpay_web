import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { db } from '@/lib/db';
import { createConversationByWalletId } from '@/lib/actions/message.actions';

export async function GET() {
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

    connection = await db.getConnection();

    const { rows } = await connection.query(
      `
      SELECT
        c.id AS "conversationId",
        c.created_at AS "conversationCreatedAt",

        u.id AS "contactId",
        u.id_wallet AS "walletId",
        u.full_name AS "fullName",
        u.phone AS "phone",
        u.profile_photo AS "profilePhoto",
        u.availabilitystatus AS "availabilityStatus",

        lm.id AS "lastMessageId",
        lm.sender_id AS "lastMessageSenderId",
        lm.content AS "lastMessage",
        lm.type AS "lastMessageType",
        lm.status AS "lastMessageStatus",
        lm.created_at AS "lastMessageTimestamp",

        COALESCE(unread.unread_count, 0)::int AS "unreadCount"

      FROM conversation_participants cp

      INNER JOIN conversations c
        ON c.id = cp.conversation_id
       AND c.is_group = false

      INNER JOIN conversation_participants other_cp
        ON other_cp.conversation_id = c.id
       AND other_cp.user_id <> $1

      INNER JOIN users u
        ON u.id = other_cp.user_id

      LEFT JOIN LATERAL (
        SELECT
          m.id,
          m.sender_id,
          m.content,
          m.type,
          m.status,
          m.created_at
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) lm ON true

      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread_count
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> $1
          AND m.is_read = false
      ) unread ON true

      WHERE cp.user_id = $1

      ORDER BY
        COALESCE(lm.created_at, c.created_at) DESC,
        c.id DESC
      `,
      [user.id]
    );

    const conversations = rows.map((row) => ({
      id: String(row.conversationId),

      contact: {
        id: row.contactId,
        walletId: row.walletId,
        fullName: row.fullName,
        phone: row.phone,
        profilePhoto: row.profilePhoto,
        availabilityStatus: row.availabilityStatus,
      },

      lastMessage: row.lastMessageId
        ? {
            id: String(row.lastMessageId),
            senderId: row.lastMessageSenderId,
            content: row.lastMessage,
            type: row.lastMessageType,
            status: row.lastMessageStatus,
            timestamp: row.lastMessageTimestamp
              ? new Date(row.lastMessageTimestamp).toISOString()
              : null,
          }
        : null,

      unreadCount: Number(row.unreadCount || 0),

      lastMessageTimestamp: row.lastMessageTimestamp
        ? new Date(row.lastMessageTimestamp).toISOString()
        : new Date(row.conversationCreatedAt).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    console.error('[API V1 CHAT CONVERSATIONS GET]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de récupérer les conversations.',
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();

    const walletId =
      typeof body.walletId === 'string'
        ? body.walletId.trim()
        : '';

    if (!walletId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet ID requis.',
        },
        { status: 400 }
      );
    }

    const result = await createConversationByWalletId(
      user.id,
      walletId
    );

    if (!result.success || !result.conversation) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            'Impossible de créer ou récupérer la conversation.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation: result.conversation,
    });
  } catch (error) {
    console.error('[API V1 CHAT CONVERSATIONS POST]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de créer ou récupérer la conversation.',
      },
      { status: 500 }
    );
  }
}
