import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const body = await request.json();

    const hostWalletId =
      body.hostWalletId ??
      request.headers.get("x-wallet-id");

    const authorized = await db.query(
      `
      SELECT 1
      FROM live_rooms
      WHERE id = $1
        AND host_wallet_id = $2
        AND is_active = TRUE
      `,
      [params.roomId, hostWalletId]
    );

    if (authorized.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Action non autorisée." },
        { status: 403 }
      );
    }

    const result = await db.query(
      `
      UPDATE live_room_participants
      SET
        role = 'SPEAKER',
        hand_raised = FALSE
      WHERE room_id = $1
        AND user_wallet_id = $2
      RETURNING *
      `,
      [params.roomId, body.userWalletId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Participant introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      participant: result.rows[0],
    });
  } catch (error) {
    console.error("ONCHAT promote speaker:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la promotion du speaker.",
      },
      { status: 500 }
    );
  }
}
