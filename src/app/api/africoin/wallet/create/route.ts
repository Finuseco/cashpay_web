
// This file is obsolete. The functionality has been moved to /api/crypto/wallet/create/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: false, error: 'This endpoint is deprecated. Please use /api/crypto/wallet/create.' }, { status: 410 });
}
