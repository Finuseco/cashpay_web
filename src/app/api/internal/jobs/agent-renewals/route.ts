import { NextRequest, NextResponse } from "next/server";
import { renewAgentSubscriptions } from "@/lib/agent-renewal";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (
    !process.env.INTERNAL_JOB_SECRET ||
    request.headers.get("x-internal-job-secret") !==
      process.env.INTERNAL_JOB_SECRET
  )
    return NextResponse.json({ success: false }, { status: 401 });
  try {
    const result = await renewAgentSubscriptions();
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Renouvellement indisponible." },
      { status: 500 },
    );
  }
}
