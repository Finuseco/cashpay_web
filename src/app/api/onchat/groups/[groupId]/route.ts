'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getGroupById } from '@/lib/actions/group.actions';

export async function GET(request: NextRequest, { params }: { params: { groupId: string } }) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const groupId = parseInt(params.groupId, 10);
        if (isNaN(groupId)) {
            return NextResponse.json({ success: false, error: 'Invalid group ID.' }, { status: 400 });
        }

        const group = await getGroupById(groupId, user.id);

        if (group) {
            return NextResponse.json({ success: true, group });
        } else {
            return NextResponse.json({ success: false, error: 'Group not found or you are not a member.' }, { status: 404 });
        }

    } catch (error) {
        console.error('[API OnChat GET Group] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
