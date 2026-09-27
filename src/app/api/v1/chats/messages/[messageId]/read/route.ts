import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));

    const walletId =
      body.walletId ??
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

    const userResult = await db.query(
      `
      SELECT id
      FROM users
      WHERE id_wallet = $1
      LIMIT 1
      `,
      [walletId]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Utilisateur CashPay introuvable.",
        },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;

    const message = await db.query(
      `
      SELECT id, conversation_id
      FROM messages
      WHERE id = $1
      `,
      [params.messageId]
    );

    if (message.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Message introuvable.",
        },
        { status: 404 }
      );
    }

    const membership = await db.query(
      `
      SELECT 1
      FROM conversation_members
      WHERE conversation_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [message.rows[0].conversation_id, userId]
    );

    if (membership.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Accès refusé.",
        },
        { status: 403 }
      );
    }

    const result = await db.query(
      `
      UPDATE messages
      SET status = 'READ'
      WHERE id = $1
      RETURNING *
      `,
      [params.messageId]
    );

    return NextResponse.json({
      success: true,
      message: result.rows[0],
    });
  } catch (error) {
    console.error("ONCHAT read message:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors du marquage du message.",
      },
      { status: 500 }
    );
  }
}
