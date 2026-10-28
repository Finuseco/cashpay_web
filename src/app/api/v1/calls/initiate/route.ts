import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

export async function POST(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    const body = await request.json();

    const callerWalletId = authenticatedUser.id_wallet;

    const receiverWalletId = body.receiverWalletId;

    if (!callerWalletId || !receiverWalletId) {
      return NextResponse.json(
        {
          success: false,
          error: "callerWalletId et receiverWalletId sont requis.",
        },
        { status: 400 }
      );
    }

    if (callerWalletId === receiverWalletId) {
      return NextResponse.json(
        {
          success: false,
          error: "Un utilisateur ne peut pas s'appeler lui-même.",
        },
        { status: 400 }
      );
    }

    const users = await db.query(
      `
      SELECT id, id_wallet
      FROM users
      WHERE id_wallet IN ($1, $2)
      `,
      [callerWalletId, receiverWalletId]
    );

    if (users.rowCount !== 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Utilisateur appelant ou destinataire introuvable.",
        },
        { status: 404 }
      );
    }

    const caller = users.rows.find(
      (user) => user.id_wallet === callerWalletId
    );

    const receiver = users.rows.find(
      (user) => user.id_wallet === receiverWalletId
    );

    if (!caller || !receiver) {
      return NextResponse.json(
        {
          success: false,
          error: "Utilisateur appelant ou destinataire introuvable.",
        },
        { status: 404 }
      );
    }

    const id = `call_${randomUUID()}`;

    const result = await db.query(
      `
      INSERT INTO call_logs (
        id,
        caller_id,
        receiver_id,
        is_video,
        status,
        duration_seconds,
        started_at,
        ended_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'MISSED',
        0,
        NOW(),
        NULL
      )
      RETURNING *
      `,
      [
        id,
        caller.id,
        receiver.id,
        body.isVideo === true,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        call: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ONCHAT initiate call:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de l'initialisation de l'appel.",
      },
      { status: 500 }
    );
  }
}

