import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MESSAGE_TYPES = [
  "TEXT",
  "AUDIO",
  "IMAGE",
  "STICKER",
  "LOCATION",
  "TRANSFER_RECEIPT",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const senderWalletId =
      body.senderWalletId ??
      request.headers.get("x-wallet-id");

    if (!senderWalletId || !body.conversationId) {
      return NextResponse.json(
        {
          success: false,
          error: "senderWalletId et conversationId sont requis.",
        },
        { status: 400 }
      );
    }

    const type = String(body.type ?? "TEXT").toUpperCase();

    if (!MESSAGE_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Type de message invalide.",
          allowedTypes: MESSAGE_TYPES,
        },
        { status: 400 }
      );
    }

    // Le Wallet ID CashPay est recherché dans users.id_wallet.
    // Les tables OnChat utilisent ensuite users.id.
    const userResult = await db.query(
      `
      SELECT id
      FROM users
      WHERE id_wallet = $1
      LIMIT 1
      `,
      [senderWalletId]
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

    const senderId = userResult.rows[0].id;

    // Vérification de l'appartenance à la conversation.
    const member = await db.query(
      `
      SELECT 1
      FROM conversation_members
      WHERE conversation_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [body.conversationId, senderId]
    );

    if (member.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Utilisateur non membre de la conversation.",
        },
        { status: 403 }
      );
    }

    const id = `msg_${randomUUID()}`;

    const result = await db.query(
      `
      INSERT INTO messages (
        id,
        conversation_id,
        sender_id,
        type,
        content,
        media_url,
        duration_seconds,
        waveform,
        transfer_amount,
        transfer_currency,
        transfer_status,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        'SENT'
      )
      RETURNING *
      `,
      [
        id,
        body.conversationId,
        senderId,
        type,
        body.content ?? null,
        body.mediaUrl ?? null,
        body.durationSeconds ?? null,
        body.waveform ?? null,
        body.transferAmount ?? null,
        body.transferCurrency ?? null,
        body.transferStatus ?? null,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ONCHAT send message:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de l'envoi du message.",
      },
      { status: 500 }
    );
  }
}

