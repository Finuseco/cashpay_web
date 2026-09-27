import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { markNotificationAsRead } from '@/lib/actions/notification.actions';

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Non authentifié.' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const notificationId = Number(id);

        if (!Number.isInteger(notificationId) || notificationId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Identifiant de notification invalide.',
                },
                { status: 400 }
            );
        }

        await markNotificationAsRead(notificationId, user.id);

        return NextResponse.json({
            success: true,
            notificationId,
            read: true,
        });
    } catch (error) {
        console.error('POST /api/v1/notifications/[id]/read:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Impossible de marquer la notification comme lue.',
            },
            { status: 500 }
        );
    }
}
