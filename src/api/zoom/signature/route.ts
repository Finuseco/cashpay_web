
'use server';

import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import config from '@/config';

// This function generates the required signature for the Zoom Meeting SDK
function generateSignature(sdkKey: string, sdkSecret: string, meetingNumber: string, role: number): string {
    const timestamp = new Date().getTime() - 30000;
    const msg = Buffer.from(sdkKey + meetingNumber + timestamp + role).toString('base64');
    const hash = crypto.createHmac('sha256', sdkSecret).update(msg).digest('base64');
    const signature = Buffer.from(`${sdkKey}.${meetingNumber}.${timestamp}.${role}.${hash}`).toString('base64');
    return signature;
}


export async function POST(request: NextRequest) {
    const sdkKey = config.apiKeys.zoomVideoSdkKey;
    const sdkSecret = config.apiKeys.zoomVideoSdkSecret;

    if (!sdkKey || !sdkSecret) {
        console.error('[Zoom Signature API] Zoom SDK Key/Secret not configured.');
        return NextResponse.json({ success: false, error: 'Zoom credentials are not configured on the server.' }, { status: 500 });
    }

    try {
        const { meetingNumber, role } = await request.json();

        if (!meetingNumber || role === undefined) {
            return NextResponse.json({ success: false, error: 'meetingNumber and role are required.' }, { status: 400 });
        }

        const signature = generateSignature(sdkKey, sdkSecret, meetingNumber, role);

        return NextResponse.json({ success: true, signature });

    } catch (error) {
        console.error('[Zoom Signature API] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred while generating the signature.' }, { status: 500 });
    }
}
