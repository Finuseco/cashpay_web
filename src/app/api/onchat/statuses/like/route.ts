import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();

        if (!user?.id) {
            return NextResponse.json(
                { success: false, error: 'Authentication required.' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const rawStatusId = body?.statusId;
        const liked = body?.liked !== false;

        if (
            rawStatusId === undefined ||
            rawStatusId === null ||
            rawStatusId === ''
        ) {
            return NextResponse.json(
                { success: false, error: 'statusId is required.' },
                { status: 400 }
            );
        }

        const statusIdentifier = String(rawStatusId).trim();

        if (!/^\d+$/.test(statusIdentifier)) {
            return NextResponse.json(
                { success: false, error: 'Invalid statusId.' },
                { status: 400 }
            );
        }

        let statusResult;

        if (statusIdentifier.length <= 10) {
            const statusId = Number(statusIdentifier);

            if (!Number.isSafeInteger(statusId) || statusId <= 0) {
                return NextResponse.json(
                    { success: false, error: 'Invalid statusId.' },
                    { status: 400 }
                );
            }

            statusResult = await db.query(
                `
                SELECT id, user_id
                FROM statuses
                WHERE id = $1
                  AND expires_at > NOW()
                LIMIT 1
                `,
                [statusId]
            );
        } else {
            const timestampMs = Number(statusIdentifier);

            if (!Number.isSafeInteger(timestampMs) || timestampMs <= 0) {
                return NextResponse.json(
                    { success: false, error: 'Invalid statusId.' },
                    { status: 400 }
                );
            }

            statusResult = await db.query(
                `
                SELECT id, user_id
                FROM statuses
                WHERE created_at >= to_timestamp($1 / 1000.0)
                  AND created_at < to_timestamp(($1 + 1) / 1000.0)
                  AND expires_at > NOW()
                ORDER BY id DESC
                LIMIT 1
                `,
                [timestampMs]
            );
        }

        if (statusResult.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Status not found or expired.' },
                { status: 404 }
            );
        }

        const statusId = Number(statusResult.rows[0].id);

        if (liked) {
            await db.query(
                `
                INSERT INTO status_likes (status_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT (status_id, user_id)
                DO NOTHING
                `,
                [statusId, user.id]
            );
        } else {
            await db.query(
                `
                DELETE FROM status_likes
                WHERE status_id = $1
                  AND user_id = $2
                `,
                [statusId, user.id]
            );
        }

        const countResult = await db.query(
            `
            SELECT COUNT(*)::int AS likes_count
            FROM status_likes
            WHERE status_id = $1
            `,
            [statusId]
        );

        const likedByMeResult = await db.query(
            `
            SELECT EXISTS (
                SELECT 1
                FROM status_likes
                WHERE status_id = $1
                  AND user_id = $2
            ) AS liked_by_me
            `,
            [statusId, user.id]
        );

        return NextResponse.json({
            success: true,
            statusId,
            likedByMe: Boolean(likedByMeResult.rows[0].liked_by_me),
            likesCount: countResult.rows[0].likes_count
        });
    } catch (error) {
        console.error('[API OnChat Status Like] Error:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'An internal server error occurred.'
            },
            { status: 500 }
        );
    }
}
