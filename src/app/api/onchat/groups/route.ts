'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createGroup, getUserGroups } from '@/lib/actions/group.actions';
import { z } from 'zod';

const groupSchema = z.object({
  name: z.string().min(3),
  currency: z.enum(['USD', 'EUR', 'CDF']),
  description: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const groups = await getUserGroups(user.id);
        return NextResponse.json({ success: true, groups });

    } catch (error) {
        console.error('[API OnChat GET Groups] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validation = groupSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ success: false, error: 'Invalid data', details: validation.error.flatten() }, { status: 400 });
        }

        const result = await createGroup(user, validation.data.name, validation.data.currency, validation.data.description, validation.data.photoUrl);

        if (result.success) {
            return NextResponse.json({ success: true, group: result.group }, { status: 201 });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

    } catch (error) {
        console.error('[API OnChat POST Group] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
