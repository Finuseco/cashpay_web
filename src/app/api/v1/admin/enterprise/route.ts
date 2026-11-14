import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { activateEnterprise, activationQuote } from "@/lib/enterprise/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser();
    if (!actor)
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    const origin = request.headers.get("origin");
    if (
      origin &&
      origin !== new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin
    )
      throw Error("Origine refusée.");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw Error("JSON requis.");
    const raw = await request.text();
    if (raw.length > 12000) throw Error("Requête trop volumineuse.");
    const body = JSON.parse(raw);
    if (
      !Number.isInteger(body.companyId) ||
      body.companyId <= 0 ||
      body.companyId > 2147483647
    )
      throw Error("Compte invalide.");
    return NextResponse.json(
      await activateEnterprise(actor.id, body.companyId, body),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.code
          ? "Activation indisponible."
          : error.name === "ZodError"
            ? "Vérifiez le formulaire."
            : error.message || "Activation refusée.",
      },
      { status: 400 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser();
    if (!actor)
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    const id = Number(request.nextUrl.searchParams.get("companyId"));
    if (!Number.isSafeInteger(id) || id <= 0) throw Error("Compte invalide.");
    return NextResponse.json(
      await activationQuote(
        actor.id,
        id,
        request.nextUrl.searchParams.get("currency") || "USD",
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.code
          ? "Tarif indisponible."
          : error.message || "Consultation refusée.",
      },
      { status: 400 },
    );
  }
}
