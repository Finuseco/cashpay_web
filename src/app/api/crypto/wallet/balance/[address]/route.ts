
import { type NextRequest, NextResponse } from 'next/server';
import { getCryptoBalance } from '@/lib/actions/crypto.actions';

export async function GET(request: NextRequest, { params }: { params: { address: string } }) {
    try {
        const { searchParams } = new URL(request.url);
        const currency = searchParams.get('currency');
        const address = params.address;

        if (!address) {
            return NextResponse.json({ success: false, error: 'Address is required.' }, { status: 400 });
        }
        if (!currency) {
            return NextResponse.json({ success: false, error: 'Currency parameter is required.' }, { status: 400 });
        }

        const result = await getCryptoBalance(address, currency);

        if (result.success) {
            return NextResponse.json(result);
        } else {
            return NextResponse.json({ success: false, error: result.error || 'Failed to get balance.' }, { status: 404 });
        }

    } catch (error) {
        console.error('[API Crypto Balance] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
