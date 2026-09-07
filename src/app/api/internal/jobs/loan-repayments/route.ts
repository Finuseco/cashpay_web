import { NextRequest, NextResponse } from 'next/server';
import { processLoanRepayments } from '@/lib/actions/loan.actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(request: NextRequest) {
  const expected = process.env.INTERNAL_JOB_SECRET;
  if (!expected) return false;
  const provided = request.headers.get('x-internal-job-secret');
  return !!provided && provided === expected;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await processLoanRepayments();
    return NextResponse.json({
      ...result,
      job: 'loan-repayments',
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Loan Repayment Job] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        job: 'loan-repayments',
        error: error?.message || 'Loan repayment job failed.',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
