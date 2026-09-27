import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { markAllNotificationsAsRead } from '@/lib/actions/notification.actions';

export async function POST() {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Non authentifié.' },
                { status: 401 }
            );
        }

        await markAllNotificationsAsRead(user.id);

        return NextResponse.json({
            success: true,
            readAll: true,
        });
    } catch (error) {
        console.error('POST /api/v1/notifications/read-all:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Impossible de marquer les notifications comme lues.',
            },
            { status: 500 }
        );
    }
}
