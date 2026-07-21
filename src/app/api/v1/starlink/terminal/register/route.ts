
import { NextResponse } from 'next/server';
import { validateApiSignature } from '@/lib/api-security';
import { registerTerminal } from '@/lib/actions/starlink.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const result = await registerTerminal({
            resellerId: body.resellerId,
            userTerminalId: body.deviceId,
            nickname: body.nickname,
            ownerWalletId: body.ownerWalletId,
            serialNumber: body.serialNumber
        });

        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
