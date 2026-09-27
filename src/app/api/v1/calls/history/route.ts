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
        id,
        caller_wallet_id,
        receiver_wallet_id,
        is_video,
        status,
        duration_seconds,
        started_at,
        ended_at
      FROM call_logs
      WHERE caller_wallet_id = $1
         OR receiver_wallet_id = $1
      ORDER BY
        COALESCE(ended_at, started_at) DESC NULLS LAST
      `,
      [walletId]
    );

    return NextResponse.json({
      success: true,
      calls: result.rows,
    });
  } catch (error) {
    console.error("ONCHAT call history:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          "Erreur lors de la récupération de l'historique des appels.",
      },
      { status: 500 }
    );
  }
}
