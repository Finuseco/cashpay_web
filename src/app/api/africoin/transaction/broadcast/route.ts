
// This file is obsolete. The functionality has been moved to /api/crypto/transaction/broadcast/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: false, error: 'This endpoint is deprecated. Please use /api/crypto/transaction/broadcast.' }, { status: 410 });
}
