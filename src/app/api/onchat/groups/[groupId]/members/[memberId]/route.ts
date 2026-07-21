'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { removeMemberFromGroup } from '@/lib/actions/group.actions';

export async function DELETE(request: NextRequest, { params }: { params: { groupId: string; memberId: string } }) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const groupId = parseInt(params.groupId, 10);
        const memberId = parseInt(params.memberId, 10);

        if (isNaN(groupId) || isNaN(memberId)) {
            return NextResponse.json({ success: false, error: 'Invalid group or member ID.' }, { status: 400 });
        }

        const result = await removeMemberFromGroup(groupId, user.id, memberId);

        if (result.success) {
            return NextResponse.json({ success: true, message: 'Member removed successfully.' });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 403 });
        }
    } catch (error) {
        console.error('[API OnChat REMOVE Member] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
