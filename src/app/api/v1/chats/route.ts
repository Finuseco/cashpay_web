import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const walletId =
      request.nextUrl.searchParams.get("walletId") ??
      request.headers.get("x-wallet-id");

    if (!walletId) {
      return NextResponse.json(
        {
          success: false,
          error: "walletId est requis.",
        },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      SELECT
        c.id,
        c.is_group,
        c.title,
        c.avatar_url,
        c.currency,
        c.created_at,

        (
          SELECT json_build_object(
            'id', m.id,
            'type', m.type,
            'content', m.content,
            'mediaUrl', m.media_url,
            'thumbnailUrl', m.thumbnail_url,
            'durationSeconds', m.duration_seconds,
            'waveform', m.waveform,
            'fileSizeBytes', m.file_size_bytes,
            'status', m.status,
            'createdAt', m.created_at
          )
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message,

        (
          SELECT COUNT(*)::integer
          FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_id <> u.id
            AND m.status <> 'READ'
        ) AS unread_count

      FROM conversations c

      INNER JOIN conversation_members cm
        ON cm.conversation_id = c.id

      INNER JOIN users u
        ON u.id = cm.user_id

      WHERE u.id_wallet = $1

      ORDER BY
        (
          SELECT MAX(m2.created_at)
          FROM messages m2
          WHERE m2.conversation_id = c.id
        ) DESC NULLS LAST,
        c.created_at DESC
      `,
      [walletId]
    );

    return NextResponse.json({
      success: true,
      chats: result.rows,
    });
  } catch (error) {
    console.error("ONCHAT chats:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la récupération des conversations.",
      },
      { status: 500 }
    );
  }
}
