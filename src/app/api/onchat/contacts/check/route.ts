'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { checkContacts, getAuthenticatedUser } from '@/lib/actions/user.actions';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        const { phoneNumbers } = await request.json();

        if (!Array.isArray(phoneNumbers) || phoneNumbers.length > 1000 || phoneNumbers.some(phone => typeof phone !== 'string' || phone.length > 32)) {
            return NextResponse.json({ success: false, error: 'phoneNumbers must be an array.' }, { status: 400 });
        }

        const results = await checkContacts(phoneNumbers);

        return NextResponse.json(results);

    } catch (error) {
        console.error('[API OnChat Check Contacts] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
