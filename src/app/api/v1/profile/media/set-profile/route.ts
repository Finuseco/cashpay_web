import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
    request: NextRequest
) {
    try {
        const user =
            await getAuthenticatedUser();

        if (!user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Authentification requise.',
                },
                {
                    status: 401,
                }
            );
        }

        const body =
            await request.json();

        const mediaId =
            Number(
                body.mediaId
            );

        if (
            !Number.isInteger(
                mediaId
            ) ||
            mediaId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'mediaId invalide.',
                },
                {
                    status: 400,
                }
            );
        }

        const result =
            await db.query(
                `
                SELECT
                    id,
                    media_type,
                    file_path,
                    mime_type,
                    visibility
                FROM media
                WHERE id = $1
                  AND owner_type = 'user'
                  AND owner_id = $2
                  AND media_type IN
                      ('image', 'album_image', 'profile')
                LIMIT 1
                `,
                [
                    mediaId,
                    user.id,
                ]
            );

        if (
            result.rows.length ===
            0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Image introuvable ou non autorisée.',
                },
                {
                    status: 404,
                }
            );
        }

        const media =
            result.rows[0];

        await db.query(
            `
            UPDATE users
            SET
                profile_photo = $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [
                media.file_path,
                user.id,
            ]
        );

        return NextResponse.json({
            success: true,
            profilePhoto:
                media.file_path,
            profilePhotoUrl:
                `https://app.cashpay-all.com${media.file_path}`,
            mediaId:
                media.id,
        });
    } catch (error) {
        console.error(
            '[API V1 PROFILE MEDIA SET PROFILE]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'Impossible de définir la photo de profil.',
            },
            {
                status: 500,
            }
        );
    }
}
