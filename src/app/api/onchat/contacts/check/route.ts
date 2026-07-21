'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { checkContacts } from '@/lib/actions/user.actions';

export async function POST(request: NextRequest) {
    try {
        const { phoneNumbers } = await request.json();

        if (!Array.isArray(phoneNumbers)) {
            return NextResponse.json({ success: false, error: 'phoneNumbers must be an array.' }, { status: 400 });
        }

        const results = await checkContacts(phoneNumbers);

        return NextResponse.json(results);

    } catch (error) {
        console.error('[API OnChat Check Contacts] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
