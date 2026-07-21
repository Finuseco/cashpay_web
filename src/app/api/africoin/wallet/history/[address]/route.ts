
// This file is obsolete. The functionality has been moved to /api/crypto/wallet/history/[address]/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ success: false, error: 'This endpoint is deprecated. Please use /api/crypto/wallet/history/[address].' }, { status: 410 });
}
