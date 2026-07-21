
import { NextResponse } from 'next/server';
import { createCryptoWallet } from '@/lib/actions/crypto.actions';

export async function POST() {
    try {
        const result = await createCryptoWallet();
        
        if (result.success) {
            return NextResponse.json(result);
        } else {
            return NextResponse.json({ success: false, error: result.error || 'Failed to create wallet.' }, { status: 500 });
        }
    } catch (error) {
        console.error('[API Crypto Create] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
