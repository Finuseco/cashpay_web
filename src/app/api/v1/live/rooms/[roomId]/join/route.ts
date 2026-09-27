import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const body = await request.json();

    const walletId =
      body.walletId ??
      request.headers.get("x-wallet-id");

    if (!walletId) {
      return NextResponse.json(
        { success: false, error: "walletId est requis." },
        { status: 400 }
      );
    }

    const room = await db.query(
      `
      SELECT *
      FROM live_rooms
      WHERE id = $1
        AND is_active = TRUE
      `,
      [params.roomId]
    );

    if (room.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Live Stage introuvable ou terminé.",
        },
        { status: 404 }
      );
    }

    const existing = await db.query(
      `
      SELECT *
      FROM live_room_participants
      WHERE room_id = $1
        AND user_wallet_id = $2
      `,
      [params.roomId, walletId]
    );

    if (existing.rowCount > 0) {
      return NextResponse.json({
        success: true,
        participant: existing.rows[0],
        alreadyJoined: true,
      });
    }

    const id = `participant_${randomUUID()}`;

    const result = await db.query(
      `
      INSERT INTO live_room_participants (
        id,
        room_id,
        user_wallet_id,
        role,
        hand_raised,
        joined_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'SPECTATOR',
        FALSE,
        NOW()
      )
      RETURNING *
      `,
      [id, params.roomId, walletId]
    );

    return NextResponse.json({
      success: true,
      participant: result.rows[0],
    });
  } catch (error) {
    console.error("ONCHAT join room:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de l'entrée dans le Live Stage.",
      },
      { status: 500 }
    );
  }
}
