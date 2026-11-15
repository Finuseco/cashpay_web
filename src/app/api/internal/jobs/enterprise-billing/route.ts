import { NextRequest, NextResponse } from "next/server";
import { billEnterprises } from "@/lib/enterprise/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (
    !process.env.INTERNAL_JOB_SECRET ||
    request.headers.get("x-internal-job-secret") !==
      process.env.INTERNAL_JOB_SECRET
  )
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  try {
    const raw = request.nextUrl.searchParams.get("userId");
    if (raw !== null && (!/^[1-9]\d*$/.test(raw) || Number(raw) > 2147483647))
      throw Error("Invalid target");
    const result = await billEnterprises(
      raw === null ? undefined : Number(raw),
    );
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Facturation entreprise indisponible." },
      { status: 500 },
    );
  }
}
