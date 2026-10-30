import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendAndStoreOtp } from '@/lib/actions/auth.actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const walletId = typeof body.walletId === 'string' ? body.walletId.trim().toUpperCase() : '';
        if (!walletId) return NextResponse.json({ success: false, error: 'Identifiant de portefeuille requis.' }, { status: 400 });
        const { rows } = await db.query("SELECT id FROM users WHERE id_wallet = $1 AND LOWER(status) = 'active'", [walletId]);
        if (!rows[0]) return NextResponse.json({ success: false, error: 'Compte indisponible.' }, { status: 400 });
        const result = await sendAndStoreOtp(rows[0].id, 'login', 'sms');
        return NextResponse.json(result.success ? { success: true, message: result.message, userId: rows[0].id } : { success: false, error: 'error' in result ? result.error : 'Envoi non confirmé.' }, { status: result.success ? 200 : 502 });
    } catch { return NextResponse.json({ success: false, error: 'Connexion indisponible.' }, { status: 500 }); }
}
