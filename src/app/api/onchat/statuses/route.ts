'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createStatus, getStatusesForUser } from '@/lib/actions/status.actions';
import { z } from 'zod';

const statusSchema = z.object({
  type: z.enum(['text', 'image', 'video']),
  content: z.string().min(1),
  backgroundColor: z.string().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const statusGroups = await getStatusesForUser(user.id);
        return NextResponse.json({ success: true, statusGroups });

    } catch (error) {
        console.error('[API OnChat GET Statuses] Error:', error);
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
        const validation = statusSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ success: false, error: 'Invalid data', details: validation.error.flatten() }, { status: 400 });
        }

        const result = await createStatus({
            userId: user.id,
            ...validation.data,
        });

        if (result.success) {
            return NextResponse.json({ success: true, message: 'Status posted.' }, { status: 201 });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

    } catch (error) {
        console.error('[API OnChat POST Status] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
