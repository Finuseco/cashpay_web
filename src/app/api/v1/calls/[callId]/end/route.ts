import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const body = await request.json();

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

    const user = await db.query(
      `
      SELECT id
      FROM users
      WHERE id_wallet = $1
      LIMIT 1
      `,
      [walletId]
    );

    if (user.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Utilisateur CashPay introuvable.",
        },
        { status: 404 }
      );
    }

    const userId = user.rows[0].id;

    const result = await db.query(
      `
      UPDATE call_logs
      SET
        status = 'COMPLETED',
        ended_at = NOW(),
        duration_seconds =
          CASE
            WHEN started_at IS NULL THEN 0
            ELSE GREATEST(
              0,
              EXTRACT(
                EPOCH FROM (NOW() - started_at)
              )::integer
            )
          END
      WHERE id = $1
        AND (
          caller_id = $2
          OR receiver_id = $2
        )
      RETURNING *
      `,
      [params.callId, userId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Appel introuvable ou accès refusé.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      call: result.rows[0],
    });
  } catch (error) {
    console.error("ONCHAT end call:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la fin de l'appel.",
      },
      { status: 500 }
    );
  }
}
