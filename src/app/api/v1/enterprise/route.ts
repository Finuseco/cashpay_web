import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import {
  listEnterprises,
  findPayroll,
  enterpriseDashboard,
  mutateEnterprise,
  previewPayroll,
  executePayroll,
} from "@/lib/enterprise/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: any) {
  console.error("[enterprise]", error?.code || error?.name || "failure");
  return NextResponse.json(
    {
      success: false,
      error: error?.code
        ? "Service entreprise indisponible. Réessayez."
        : error?.name === "ZodError"
          ? "Vérifiez les champs du formulaire."
          : error?.message || "Service indisponible.",
    },
    { status: 400, headers },
  );
}
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser();
    if (!actor)
      return NextResponse.json(
        { success: false, error: "Connectez-vous." },
        { status: 401, headers },
      );
    const company = request.nextUrl.searchParams.get("companyId");
    if (company !== null) {
      if (!/^[1-9]\d*$/.test(company) || Number(company) > 2147483647)
        throw Error("Entreprise invalide.");
      const key = request.nextUrl.searchParams.get("requestKey");
      return NextResponse.json(
        key
          ? await findPayroll(actor.id, Number(company), key)
          : await enterpriseDashboard(actor.id, Number(company)),
        { headers },
      );
    }
    return NextResponse.json(
      { success: true, companies: await listEnterprises(actor.id) },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser();
    if (!actor)
      return NextResponse.json(
        { success: false, error: "Connectez-vous." },
        { status: 401, headers },
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
    if (raw.length > 128000) throw Error("Requête trop volumineuse.");
    const body = JSON.parse(raw);
    let value;
    if (body.action === "preview") value = await previewPayroll(actor.id, body);
    else if (body.action === "pay")
      value = await executePayroll(actor.id, body);
    else {
      if (!Number.isInteger(body.companyId) || body.companyId <= 0)
        throw Error("Entreprise invalide.");
      value = await mutateEnterprise(actor.id, body.companyId, body);
    }
    return NextResponse.json(value, { headers });
  } catch (error) {
    return failure(error);
  }
}
