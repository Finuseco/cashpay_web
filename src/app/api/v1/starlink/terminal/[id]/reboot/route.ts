
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getResellerConfig } from '@/lib/actions/starlink.actions';
import { rebootTerminal } from '@/services/starlink';
import { validateApiSignature } from '@/lib/api-security';

export async function POST(request: Request, { params }: { params: { id: string } }) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    try {
        const config = await getResellerConfig(user.id);
        if (!config) return NextResponse.json({ success: false, error: "Reseller account not linked" }, { status: 400 });

        await rebootTerminal(config.apiKey, config.apiSecret, params.id);
        return NextResponse.json({ success: true, message: "Reboot initiated" });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
