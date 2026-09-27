import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getNotifications } from '@/lib/actions/notification.actions';

export async function GET(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Non authentifié.' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const rawLimit = Number(searchParams.get('limit') || '20');

        const limit = Number.isFinite(rawLimit)
            ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
            : 20;

        const notifications = await getNotifications(user.id, limit);

        return NextResponse.json({
            success: true,
            count: notifications.length,
            notifications,
        });
    } catch (error) {
        console.error('GET /api/v1/notifications:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Impossible de récupérer les notifications.',
            },
            { status: 500 }
        );
    }
}
