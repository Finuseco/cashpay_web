import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { db } from "@/lib/db";
import { approveInternationalClaim } from "@/lib/actions/super-agent/finance.actions";
export const dynamic = "force-dynamic";
async function admin() {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "Admin") throw Error("Session Admin requise.");
  return user;
}
export async function GET(request: Request) {
  try {
    await admin();
    const page = Math.floor(
      Math.min(
        10000,
        Math.max(0, Number(new URL(request.url).searchParams.get("page")) || 0),
      ),
    );
    const { rows } = await db.query(
      `SELECT cl.id,cl.provider,cl.expected_amount,cl.expected_currency,cl.receive_in_currency,cl.status,cl.created_at,cl.user_id,u.full_name,u.id_wallet,u.country,u.province,ic.status AS processing_status,ic.agent_user_id,a.full_name AS agent_name,a.id_wallet AS agent_wallet FROM international_transfer_claims cl JOIN users u ON u.id=cl.user_id LEFT JOIN inter_claim_cases ic ON ic.claim_id=cl.id LEFT JOIN users a ON a.id=ic.agent_user_id ORDER BY cl.id DESC LIMIT 51 OFFSET $1`,
      [page * 50],
    );
    const history = await db.query(
      `SELECT e.id,e.claim_id,e.action,e.detail,e.created_at,u.full_name AS actor_name,u.id_wallet AS actor_wallet FROM inter_claim_audit e JOIN users u ON u.id=e.actor_user_id ORDER BY e.id DESC LIMIT 101 OFFSET $1`,
      [page * 100],
    );
    return NextResponse.json(
      {
        success: true,
        claims: rows.slice(0, 50),
        hasMore: rows.length > 50,
        history: history.rows.slice(0, 100),
        historyHasMore: history.rows.length > 100,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          e.code === "42P01"
            ? "Schéma inter-agent manquant. Installez les migrations inter-agent existantes."
            : e.message,
      },
      { status: 403 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const user = await admin(),
      body = await request.json(),
      id = Number(body.id);
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      body.action !== "approve" ||
      typeof body.pin !== "string"
    )
      throw Error("Action invalide.");
    const result = await approveInternationalClaim(
      id,
      Number(user.id),
      body.pin,
    );
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 403 },
    );
  }
}
