import { NextRequest, NextResponse } from 'next/server';
import { sendRegistrationOtp } from '@/lib/actions/auth.actions';
import { countries } from '@/lib/countries';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
        const country = countries.find(item => item.code === String(body.countryCode || '').toUpperCase());
        if (!country || !/^\+?[0-9]{8,15}$/.test(phone)) return NextResponse.json({ success: false, error: 'Téléphone ou pays invalide.' }, { status: 400 });
        const result = await sendRegistrationOtp(phone, 'sms');
        return NextResponse.json(result.success ? { success: true, message: 'Code envoyé.' } : { success: false, error: result.error }, { status: result.success ? 200 : 502 });
    } catch { return NextResponse.json({ success: false, error: 'Inscription indisponible.' }, { status: 500 }); }
}
