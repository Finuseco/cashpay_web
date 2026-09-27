import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
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

    const limit = Math.min(
      Math.max(
        Number(request.nextUrl.searchParams.get("limit") ?? 50),
        1
      ),
      100
    );

    const before = request.nextUrl.searchParams.get("before");

    // Identification de l'utilisateur CashPay
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

    // Vérification de l'accès à la conversation
    const membership = await db.query(
      `
      SELECT 1
      FROM conversation_members
      WHERE conversation_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [params.conversationId, userId]
    );

    if (membership.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversation inaccessible.",
        },
        { status: 403 }
      );
    }

    const values: unknown[] = [params.conversationId];
    let beforeSql = "";

    if (before) {
      values.push(before);
      beforeSql = `AND m.created_at < $${values.length}`;
    }

    values.push(limit);

    const result = await db.query(
      `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        u.id_wallet AS sender_wallet_id,
        u.full_name AS sender_name,
        u.profile_photo AS sender_avatar,
        m.type,
        m.content,
        m.media_url,
        m.thumbnail_url,
        m.duration_seconds,
        m.waveform,
        m.file_size_bytes,
        m.transfer_amount,
        m.transfer_currency,
        m.transfer_transaction_id,
        m.transfer_status,
        m.status,
        m.created_at
      FROM messages m
      LEFT JOIN users u
        ON u.id = m.sender_id
      WHERE m.conversation_id = $1
      ${beforeSql}
      ORDER BY m.created_at DESC
      LIMIT $${values.length}
      `,
      values
    );

    return NextResponse.json({
      success: true,
      conversationId: params.conversationId,
      messages: result.rows,
      hasMore: result.rows.length === limit,
    });
  } catch (error) {
    console.error("ONCHAT messages:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la récupération des messages.",
      },
      { status: 500 }
    );
  }
}
