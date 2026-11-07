import { db } from "@/lib/db";
import { LOAN_INTERNAL_CONTEXT } from "@/lib/loan-internal-context";
import { NextRequest, NextResponse } from "next/server";
import { processLoanRepayments } from "@/lib/actions/loan.actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const expected = process.env.INTERNAL_JOB_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-internal-job-secret");
  return !!provided && provided === expected;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  try {
    const result: any = await processLoanRepayments(
      undefined,
      LOAN_INTERNAL_CONTEXT,
    );
    const queue = (
      await db.query("SELECT to_regclass('loan_repayment_queue') AS queue")
    ).rows[0]?.queue;
    if (queue)
      await db.query(
        `DELETE FROM loan_repayment_queue q WHERE q.requested_at<=$1::timestamptz AND (q.user_id=ANY($2::int[]) OR NOT EXISTS(SELECT 1 FROM loans l WHERE l.user_id=q.user_id AND LOWER(l.status::text) IN ('approved','defaulted','overdue') AND (EXISTS(SELECT 1 FROM loan_installments i WHERE i.loan_id=l.id AND i.due_date::date<=CURRENT_DATE-7 AND COALESCE(i.amount,0)+COALESCE(i.penalty_amount,0)-COALESCE(i.paid_amount,0)>0) OR (l.remaining_balance>0 AND l.end_date::date<=CURRENT_DATE-7))))`,
        [new Date(startedAt).toISOString(), result.successfulUserIds || []],
      );
    return NextResponse.json(
      {
        ...result,
        job: "loan-repayments",
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: result.error || result.failed ? 500 : 200 },
    );
  } catch (error: any) {
    console.error("[Loan Repayment Job] Failed:", error);
    return NextResponse.json(
      {
        success: false,
        job: "loan-repayments",
        error: error?.message || "Loan repayment job failed.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
