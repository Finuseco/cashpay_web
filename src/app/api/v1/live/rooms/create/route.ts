import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const hostWalletId =
      body.hostWalletId ??
      request.headers.get("x-wallet-id");

    if (!hostWalletId || !body.title || !body.roomType) {
      return NextResponse.json(
        {
          success: false,
          error: "hostWalletId, title et roomType sont requis.",
        },
        { status: 400 }
      );
    }

    const roomType = String(body.roomType).toUpperCase();

    if (!["VIDEO_STAGE", "AUDIO_STAGE"].includes(roomType)) {
      return NextResponse.json(
        {
          success: false,
          error: "roomType invalide.",
        },
        { status: 400 }
      );
    }

    const id = `room_${randomUUID()}`;

    const result = await db.query(
      `
      INSERT INTO live_rooms (
        id,
        title,
        room_type,
        host_wallet_id,
        is_active,
        max_spectators,
        created_at,
        ended_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        TRUE,
        $5,
        NOW(),
        NULL
      )
      RETURNING *
      `,
      [
        id,
        body.title,
        roomType,
        hostWalletId,
        body.maxSpectators ?? null,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        room: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ONCHAT create room:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la création du Live Stage.",
      },
      { status: 500 }
    );
  }
}
