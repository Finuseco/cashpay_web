'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { addMemberToGroup } from '@/lib/actions/group.actions';
import { z } from 'zod';

const addMemberSchema = z.object({
  userId: z.number().int(),
});

export async function POST(request: NextRequest, { params }: { params: { groupId: string } }) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const groupId = parseInt(params.groupId, 10);
        if (isNaN(groupId)) {
            return NextResponse.json({ success: false, error: 'Invalid group ID.' }, { status: 400 });
        }

        const body = await request.json();
        const validation = addMemberSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ success: false, error: 'Invalid data', details: validation.error.flatten() }, { status: 400 });
        }

        const result = await addMemberToGroup(groupId, user.id, validation.data.userId);

        if (result.success) {
            return NextResponse.json({ success: true, message: 'Member added successfully.' });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 403 });
        }

    } catch (error) {
        console.error('[API OnChat ADD Member] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
