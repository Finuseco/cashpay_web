
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { linkStarlinkResellerAccount } from '@/lib/actions/starlink.actions';
import { validateApiSignature } from '@/lib/api-security';

export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user || user.role !== 'Agent' && user.role !== 'Admin') {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const result = await linkStarlinkResellerAccount(user, body);
        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
