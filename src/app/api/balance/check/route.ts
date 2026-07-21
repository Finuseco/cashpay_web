
// This API endpoint now lives in the new API gateway application (port 8002).
// This file in the main app serves as a placeholder to avoid breaking old integrations
// and to gently guide developers to the new endpoint.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { 
        success: false, 
        error: "This API endpoint has been moved. Please use the new API gateway." 
    }, 
    { status: 410 } // 410 Gone
  );
}
