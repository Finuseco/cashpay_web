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

    // call_logs stores caller_id / receiver_id (integer user IDs), not wallet IDs.
    // We resolve the walletId → user.id first, then query.
    const userRow = await db.query(
      `SELECT id FROM users WHERE id_wallet = $1 LIMIT 1`,
      [walletId]
    );

    if (userRow.rowCount === 0) {
      return NextResponse.json({ success: true, calls: [] });
    }

    const userId = userRow.rows[0].id;

    const result = await db.query(
      `
      SELECT
        cl.id,
        cl.is_video,
        cl.status,
        cl.duration_seconds,
        cl.started_at,
        cl.ended_at,
        caller.id_wallet  AS caller_wallet_id,
        caller.full_name  AS caller_name,
        caller.profile_photo AS caller_photo,
        recv.id_wallet    AS receiver_wallet_id,
        recv.full_name    AS receiver_name,
        recv.profile_photo AS receiver_photo
      FROM call_logs cl
      JOIN users caller ON caller.id = cl.caller_id
      JOIN users recv   ON recv.id   = cl.receiver_id
      WHERE cl.caller_id = $1
         OR cl.receiver_id = $1
      ORDER BY COALESCE(cl.ended_at, cl.started_at) DESC NULLS LAST
      LIMIT 100
      `,
      [userId]
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
