
import { NextResponse } from 'next/server';
import { handleUssdRequest } from '@/lib/ussd/ussd.router';

/**
 * @fileoverview Endpoint API USSD public.
 * Sert de passerelle vers le Router Souverain.
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const sessionId = formData.get('sessionId') as string;
        const phoneNumber = formData.get('phoneNumber') as string;
        const text = formData.get('text') as string || "";

        if (!sessionId || !phoneNumber) {
            return new Response("Missing parameters", { status: 400 });
        }

        const response = await handleUssdRequest(sessionId, phoneNumber, text);
        return new Response(response, {
            headers: { 'Content-Type': 'text/plain' },
        });
    } catch (error) {
        return new Response("Internal Server Error", { status: 500 });
    }
}
