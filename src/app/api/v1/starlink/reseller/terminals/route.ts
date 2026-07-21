
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getTerminalsForReseller } from '@/lib/actions/starlink.actions';
import { validateApiSignature } from '@/lib/api-security';

export async function GET(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    try {
        const result = await getTerminalsForReseller(user.id);
        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
