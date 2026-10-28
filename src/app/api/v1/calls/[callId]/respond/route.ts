import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

const STATUSES = [
  "COMPLETED",
  "MISSED",
  "REJECTED",
  "BUSY",
];

export async function POST(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    const body = await request.json();

    const walletId = authenticatedUser.id_wallet;

    if (!walletId || !body.status) {
      return NextResponse.json(
        {
          success: false,
          error: "walletId et status sont requis.",
        },
        { status: 400 }
      );
    }

    const status = String(body.status).toUpperCase();

    if (!STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Statut d'appel invalide.",
          allowedStatuses: STATUSES,
        },
        { status: 400 }
      );
    }

    const receiver = await db.query(
      `
      SELECT id
      FROM users
      WHERE id_wallet = $1
      LIMIT 1
      `,
      [walletId]
    );

    if (receiver.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Utilisateur CashPay introuvable.",
        },
        { status: 404 }
      );
    }

    const receiverId = receiver.rows[0].id;

    const call = await db.query(
      `
      SELECT *
      FROM call_logs
      WHERE id = $1
        AND receiver_id = $2
      LIMIT 1
      `,
      [params.callId, receiverId]
    );

    if (call.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Appel introuvable ou accès refusé.",
        },
        { status: 404 }
      );
    }

    const result = await db.query(
      `
      UPDATE call_logs
      SET
        status = $2::varchar(20),
        ended_at =
          CASE
            WHEN $2::varchar(20) IN ('REJECTED', 'BUSY', 'MISSED')
              THEN NOW()
            ELSE ended_at
          END
      WHERE id = $1
      RETURNING *
      `,
      [params.callId, status]
    );

    return NextResponse.json({
      success: true,
      call: result.rows[0],
    });
  } catch (error) {
    console.error("ONCHAT respond call:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la réponse à l'appel.",
      },
      { status: 500 }
    );
  }
}
