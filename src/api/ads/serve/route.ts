// This file is no longer needed as the ad-serving logic has been moved to a separate application on port 8089.
// This file can be safely deleted.
import { NextResponse } from 'next/server';

export async function GET() {
    const transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return new NextResponse(transparentPixel, { headers: { 'Content-Type': 'image/gif' } });
}
