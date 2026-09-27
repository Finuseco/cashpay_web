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

    const result = await db.query(
      `
      UPDATE live_rooms
      SET
        is_active = FALSE,
        ended_at = NOW()
      WHERE id = $1
        AND host_wallet_id = $2
        AND is_active = TRUE
      RETURNING *
      `,
      [params.roomId, hostWalletId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Live Stage introuvable ou action non autorisée.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      room: result.rows[0],
    });
  } catch (error) {
    console.error("ONCHAT end room:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la fermeture du Live Stage.",
      },
      { status: 500 }
    );
  }
}
