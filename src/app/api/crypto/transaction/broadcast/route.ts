
import { type NextRequest, NextResponse } from 'next/server';
import { broadcastCryptoTransaction } from '@/lib/actions/crypto.actions';

export async function POST(request: NextRequest) {
    try {
        const { signedTx, currency } = await request.json();

        if (!signedTx || !currency) {
            return NextResponse.json({ success: false, error: 'Signed transaction data and currency are required.' }, { status: 400 });
        }
        
        const result = await broadcastCryptoTransaction(signedTx, currency);
        
        if (result.success) {
            return NextResponse.json(result);
        } else {
            return NextResponse.json({ success: false, error: result.error || 'Failed to broadcast transaction.' }, { status: 500 });
        }

    } catch (error) {
        console.error('[API Crypto Broadcast] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
