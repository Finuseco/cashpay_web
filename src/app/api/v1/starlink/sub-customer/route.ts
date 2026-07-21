
import { NextResponse } from 'next/server';
import { validateApiSignature } from '@/lib/api-security';
import { saveSubCustomer } from '@/lib/actions/starlink.actions';

export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    try {
        const body = await request.json();
        const result = await saveSubCustomer({
            terminalId: body.terminalId,
            name: body.name,
            walletId: body.walletId,
            pinCode: body.pinCode,
            macAddress: body.macAddress,
            expiryDate: body.expiryDate,
            dataLimitGb: body.dataLimitGb
        });

        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
