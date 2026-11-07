import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, updatePin } from '@/lib/actions/user.actions';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        const { oldPin, newPin } = await request.json();
        if (typeof oldPin !== 'string' || typeof newPin !== 'string' || !/^\d{4}$/.test(oldPin) || !/^\d{4}$/.test(newPin)) return NextResponse.json({ success: false, error: 'Les PIN doivent contenir quatre chiffres.' }, { status: 400 });
        const result = await updatePin({ userId: user.id, oldPin, newPin });
        return NextResponse.json(result.success ? { success: true, message: 'PIN mis à jour.' } : result, { status: result.success ? 200 : 400 });
    } catch { return NextResponse.json({ success: false, error: 'Modification impossible.' }, { status: 500 }); }
}
