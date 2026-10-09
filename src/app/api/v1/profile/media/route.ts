import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE_URL = 'https://app.cashpay-all.com';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

const ALLOWED_MEDIA_TYPES = new Set([
    'image',
    'album_image',
    'profile',
    'cover',
]);

const ALLOWED_VISIBILITIES = new Set([
    'public',
    'private',
]);

function extensionFromMime(mime: string) {
    switch (mime) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        default:
            return 'bin';
    }
}

function publicUrl(filePath: string | null) {
    if (!filePath) {
        return null;
    }

    if (/^https?:\/\//i.test(filePath)) {
        return filePath;
    }

    return `${BASE_URL}${filePath}`;
}

function storageDirectory(mediaType: string) {
    if (mediaType === 'profile') {
        return path.join(
            process.cwd(),
            'public',
            'images',
            'profiles',
            'avatars'
        );
    }

    if (mediaType === 'cover') {
        return path.join(
            process.cwd(),
            'public',
            'images',
            'profiles',
            'covers'
        );
    }

    return path.join(
        process.cwd(),
        'public',
        'images',
        'profiles',
        'albums'
    );
}

function publicDirectory(mediaType: string) {
    if (mediaType === 'profile') {
        return '/images/profiles/avatars';
    }

    if (mediaType === 'cover') {
        return '/images/profiles/covers';
    }

    return '/images/profiles/albums';
}

function physicalPathFromPublicPath(
    filePath: string | null
) {
    if (!filePath) {
        return null;
    }

    if (!filePath.startsWith('/images/profiles/')) {
        return null;
    }

    return path.join(
        process.cwd(),
        'public',
        filePath
    );
}

function serializeMedia(item: any) {
    return {
        id: item.id,
        type: item.media_type,
        fileName: item.file_name,
        filePath: item.file_path,
        url: publicUrl(item.file_path),
        mimeType: item.mime_type,
        fileSize: item.file_size,
        visibility: item.visibility,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        expiresAt: item.expires_at,
        isProfile: Boolean(item.is_profile),
        isCover: Boolean(item.is_cover),
    };
}

export async function GET() {
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
                { status: 401 }
            );
        }

        const { rows } =
            await db.query(
                `
                SELECT
                    m.id,
                    m.owner_type,
                    m.owner_id,
                    m.media_type,
                    m.file_name,
                    m.file_path,
                    m.mime_type,
                    m.file_size,
                    m.visibility,
                    m.created_at,
                    m.updated_at,
                    m.expires_at,
                    CASE
                        WHEN u.profile_photo = m.file_path
                        THEN true
                        ELSE false
                    END AS is_profile,
                    CASE
                        WHEN u.cover_photo = m.file_path
                        THEN true
                        ELSE false
                    END AS is_cover
                FROM media m
                INNER JOIN users u
                    ON u.id = m.owner_id
                WHERE m.owner_type = 'user'
                  AND m.owner_id = $1
                ORDER BY m.created_at DESC
                `,
                [user.id]
            );

        const media =
            rows.map(serializeMedia);

        return NextResponse.json({
            success: true,
            media,
            count: media.length,
        });
    } catch (error) {
        console.error(
            '[API V1 PROFILE MEDIA GET]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'Impossible de récupérer les médias.',
            },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest
) {
    let physicalPath: string | null = null;

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
                { status: 401 }
            );
        }

        const formData =
            await request.formData();

        const file =
            formData.get('file');

        const requestedType =
            String(
                formData.get('mediaType') ||
                'image'
            );

        const requestedVisibility =
            String(
                formData.get('visibility') ||
                'public'
            );

        if (!(file instanceof File)) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Fichier image requis.',
                },
                { status: 400 }
            );
        }

        if (
            !ALLOWED_MEDIA_TYPES.has(
                requestedType
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Type de média invalide.',
                },
                { status: 400 }
            );
        }

        if (
            !ALLOWED_VISIBILITIES.has(
                requestedVisibility
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Visibilité invalide.',
                },
                { status: 400 }
            );
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Format image non autorisé.',
                },
                { status: 400 }
            );
        }

        if (
            file.size <= 0 ||
            file.size > MAX_IMAGE_SIZE
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Image trop volumineuse. Maximum : 10 MB.',
                },
                { status: 400 }
            );
        }

        const mediaType =
            requestedType;

        const visibility =
            mediaType === 'profile' ||
            mediaType === 'cover'
                ? 'public'
                : requestedVisibility;

        const extension =
            extensionFromMime(file.type);

        const uniqueName =
            `user_${user.id}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${extension}`;

        const directoryPath =
            storageDirectory(mediaType);

        await fs.mkdir(
            directoryPath,
            { recursive: true }
        );

        physicalPath =
            path.join(
                directoryPath,
                uniqueName
            );

        const buffer =
            Buffer.from(
                await file.arrayBuffer()
            );

        await fs.writeFile(
            physicalPath,
            buffer
        );

        const relativePath =
            `${publicDirectory(mediaType)}/${uniqueName}`;

        await db.query('BEGIN');

        try {
            let saved;

            if (
                mediaType === 'profile' ||
                mediaType === 'cover'
            ) {
                const result =
                    await db.query(
                        `
                        INSERT INTO media
                        (
                            owner_type,
                            owner_id,
                            media_type,
                            file_name,
                            file_path,
                            mime_type,
                            file_size,
                            visibility
                        )
                        VALUES
                        (
                            'user',
                            $1,
                            $2,
                            $3,
                            $4,
                            $5,
                            $6,
                            $7
                        )
                        ON CONFLICT
                        (
                            owner_type,
                            owner_id,
                            media_type
                        )
                        WHERE media_type IN ('profile', 'cover')
                        DO UPDATE SET
                            file_name = EXCLUDED.file_name,
                            file_path = EXCLUDED.file_path,
                            mime_type = EXCLUDED.mime_type,
                            file_size = EXCLUDED.file_size,
                            visibility = EXCLUDED.visibility,
                            updated_at = NOW()
                        RETURNING
                            id,
                            media_type,
                            file_name,
                            file_path,
                            mime_type,
                            file_size,
                            visibility,
                            created_at,
                            updated_at,
                            expires_at
                        `,
                        [
                            user.id,
                            mediaType,
                            file.name,
                            relativePath,
                            file.type,
                            file.size,
                            visibility,
                        ]
                    );

                saved = result.rows[0];

                if (mediaType === 'profile') {
                    await db.query(
                        `
                        UPDATE users
                        SET
                            profile_photo = $1,
                            updated_at = NOW()
                        WHERE id = $2
                        `,
                        [
                            relativePath,
                            user.id,
                        ]
                    );
                }

                if (mediaType === 'cover') {
                    await db.query(
                        `
                        UPDATE users
                        SET
                            cover_photo = $1,
                            updated_at = NOW()
                        WHERE id = $2
                        `,
                        [
                            relativePath,
                            user.id,
                        ]
                    );
                }
            } else {
                const result =
                    await db.query(
                        `
                        INSERT INTO media
                        (
                            owner_type,
                            owner_id,
                            media_type,
                            file_name,
                            file_path,
                            mime_type,
                            file_size,
                            visibility
                        )
                        VALUES
                        (
                            'user',
                            $1,
                            $2,
                            $3,
                            $4,
                            $5,
                            $6,
                            $7
                        )
                        RETURNING
                            id,
                            media_type,
                            file_name,
                            file_path,
                            mime_type,
                            file_size,
                            visibility,
                            created_at,
                            updated_at,
                            expires_at
                        `,
                        [
                            user.id,
                            mediaType,
                            file.name,
                            relativePath,
                            file.type,
                            file.size,
                            visibility,
                        ]
                    );

                saved = result.rows[0];
            }

            await db.query('COMMIT');

            return NextResponse.json(
                {
                    success: true,
                    media: serializeMedia({
                        ...saved,
                        is_profile:
                            mediaType === 'profile',
                        is_cover:
                            mediaType === 'cover',
                    }),
                },
                { status: 201 }
            );
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        if (physicalPath) {
            await fs.unlink(
                physicalPath
            ).catch(
                () => undefined
            );
        }

        console.error(
            '[API V1 PROFILE MEDIA POST]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'Impossible d’enregistrer le média.',
            },
            { status: 500 }
        );
    }
}
