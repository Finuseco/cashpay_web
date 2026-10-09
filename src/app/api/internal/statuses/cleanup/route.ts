import { NextResponse, type NextRequest } from 'next/server';
import { deleteExpiredStatuses } from '@/lib/actions/status.actions';
import { deleteExpiredMedia } from '@/lib/actions/media.actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const expectedSecret = process.env.STATUS_CLEANUP_SECRET;

        if (!expectedSecret) {
            console.error(
                '[Status Cleanup API] STATUS_CLEANUP_SECRET is not configured.'
            );

            return NextResponse.json(
                {
                    success: false,
                    error: 'Cleanup secret not configured.'
                },
                { status: 500 }
            );
        }

        const receivedSecret =
            request.headers.get('x-status-cleanup-secret') || '';

        if (receivedSecret !== expectedSecret) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Unauthorized.'
                },
                { status: 401 }
            );
        }

        await deleteExpiredStatuses();

        return NextResponse.json({
            success: true,
            message: 'Expired statuses cleanup executed.'
        });
    } catch (error) {
        console.error(
            '[Status Cleanup API] Error:',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: 'Cleanup failed.'
            },
            { status: 500 }
        );
    }
}
