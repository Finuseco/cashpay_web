
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getResellerConfig } from '@/lib/actions/starlink.actions';
import { fetchUserTerminals } from '@/services/starlink';
import { validateApiSignature } from '@/lib/api-security';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    try {
        const config = await getResellerConfig(user.id);
        if (!config) return NextResponse.json({ success: false, error: "Reseller configuration missing" }, { status: 400 });

        const terminals = await fetchUserTerminals(config.apiKey, config.apiSecret);
        const terminal = terminals.find((t: any) => t.userTerminalId === params.id);
        
        if (!terminal) return NextResponse.json({ success: false, error: "Terminal not found" }, { status: 404 });

        return NextResponse.json({ success: true, data: terminal });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
