import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { db } from "@/lib/db";
import { processTvSubscription } from "@/lib/actions/super-agent/staff.actions";
export const dynamic = "force-dynamic";
async function admin() {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "Admin") throw Error("Session Admin requise.");
  return user;
}
export async function GET(request: Request) {
  try {
    await admin();
    const url = new URL(request.url),
      page = Math.min(
        10000,
        Math.max(0, Number(url.searchParams.get("page")) || 0),
      ),
      status = url.searchParams.get("status") || "pending";
    if (!["pending", "active", "cancelled", "all"].includes(status))
      return NextResponse.json(
        { success: false, error: "Statut invalide." },
        { status: 400 },
      );
    const { rows } = await db.query(
      `SELECT s.*,u.full_name,u.id_wallet,u.country,t.currency,t.status AS payment_status FROM subscriptions s JOIN users u ON u.id=s.user_id JOIN transactions t ON t.id=s.transaction_id WHERE ($1='all' OR s.status=$1) ORDER BY s.id DESC LIMIT 51 OFFSET $2`,
      [status, Math.floor(page) * 50],
    );
    const history = await db.query(
      "SELECT e.id,e.action_type AS action,e.detail,e.created_at,u.full_name AS actor_name,u.id_wallet AS actor_wallet FROM super_agent_interventions e JOIN users u ON u.id=e.admin_user_id WHERE e.action_type IN ('TV_ACTIVATION','TV_REFUND') ORDER BY e.id DESC LIMIT 101 OFFSET $1",
      [Math.floor(page) * 100],
    );
    return NextResponse.json(
      {
        success: true,
        requests: rows.slice(0, 50),
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
            ? "Installez migrations/20261104_service_subscriptions.sql."
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
      !["activate", "reject"].includes(body.action) ||
      typeof body.pin !== "string"
    )
      throw Error("Demande invalide.");
    const result = await processTvSubscription({
      requestId: id,
      adminId: Number(user.id),
      action: body.action,
      pin: body.pin,
      providerReference: body.providerReference,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 403 },
    );
  }
}
