'use server';

import {
    NextResponse,
    type NextRequest
} from 'next/server';

import {
    createStatus,
    getStatusesForUser
} from '@/lib/actions/status.actions';

import {
    getAuthenticatedUser
} from '@/lib/actions/user.actions';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const ALLOWED_IMAGES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
]);

const ALLOWED_VIDEOS = new Set([
    'video/mp4',
    'video/webm',
    'video/quicktime'
]);

function getBaseUrl(request: NextRequest) {
    const configured =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL;

    if (configured) {
        return configured.replace(/\/+$/, '');
    }

    const forwardedProto =
        request.headers.get('x-forwarded-proto');

    const forwardedHost =
        request.headers.get('x-forwarded-host');

    const host =
        forwardedHost ||
        request.headers.get('host');

    const protocol =
        forwardedProto ||
        'https';

    if (host) {
        return `${protocol}://${host}`;
    }

    return 'https://app.cashpay-all.com';
}

function buildPublicUrl(
    request: NextRequest,
    content: string
) {
    if (
        content.startsWith('https://') ||
        content.startsWith('http://')
    ) {
        return content;
    }

    return `${getBaseUrl(request)}${content}`;
}

/*
 * POST
 *
 * Le userId n'est jamais accepté depuis le mobile.
 * L'identité vient du Bearer token via getAuthenticatedUser().
 *
 * JSON :
 * {
 *   type: "text",
 *   content: "...",
 *   backgroundColor: "..."
 * }
 *
 * FormData :
 * type=image|video
 * file=<fichier>
 * backgroundColor=<optionnel>
 */
export async function POST(
    request: NextRequest
) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Authentication required.'
                },
                { status: 401 }
            );
        }

        const contentType =
            request.headers.get('content-type') || '';

        let type:
            | 'text'
            | 'image'
            | 'video';

        let content: string;
        let backgroundColor:
            | string
            | undefined;

        if (
            contentType
                .toLowerCase()
                .includes('multipart/form-data')
        ) {
            const formData =
                await request.formData();

            const requestedType =
                String(
                    formData.get('type') || ''
                );

            if (
                requestedType !== 'image' &&
                requestedType !== 'video'
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'For media, type must be image or video.'
                    },
                    { status: 400 }
                );
            }

            type = requestedType;

            const file =
                formData.get('file');

            if (!(file instanceof File)) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'Media file is required.'
                    },
                    { status: 400 }
                );
            }

            const mimeType =
                file.type.toLowerCase();

            if (
                type === 'image' &&
                !ALLOWED_IMAGES.has(mimeType)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'Unsupported image format.'
                    },
                    { status: 400 }
                );
            }

            if (
                type === 'video' &&
                !ALLOWED_VIDEOS.has(mimeType)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'Unsupported video format.'
                    },
                    { status: 400 }
                );
            }

            const maxSize =
                type === 'video'
                    ? MAX_VIDEO_SIZE
                    : MAX_IMAGE_SIZE;

            if (file.size <= 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'Empty media file.'
                    },
                    { status: 400 }
                );
            }

            if (file.size > maxSize) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            type === 'video'
                                ? 'Video file is too large.'
                                : 'Image file is too large.'
                    },
                    { status: 413 }
                );
            }

            const buffer =
                Buffer.from(
                    await file.arrayBuffer()
                );

            const base64 =
                buffer.toString('base64');

            content =
                `data:${mimeType};base64,${base64}`;

            const color =
                formData.get(
                    'backgroundColor'
                );

            backgroundColor =
                typeof color === 'string' &&
                color.trim()
                    ? color.trim()
                    : undefined;
        } else {
            const body =
                await request.json();

            if (
                body?.type !== 'text'
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'JSON status creation only supports text.'
                    },
                    { status: 400 }
                );
            }

            type = 'text';

            if (
                typeof body.content !==
                    'string' ||
                !body.content.trim()
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'Text content is required.'
                    },
                    { status: 400 }
                );
            }

            content =
                body.content.trim();

            backgroundColor =
                typeof body.backgroundColor ===
                    'string' &&
                body.backgroundColor.trim()
                    ? body.backgroundColor.trim()
                    : undefined;
        }

        const result =
            await createStatus({
                userId: user.id,
                type,
                content,
                backgroundColor
            });

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error
                },
                { status: 500 }
            );
        }

        const publicContent =
            result.content
                ? buildPublicUrl(
                    request,
                    result.content
                )
                : undefined;

        return NextResponse.json(
            {
                success: true,
                status: {
                    id: result.statusId,
                    userId: user.id,
                    type,
                    content: publicContent,
                    backgroundColor:
                        backgroundColor ?? null,
                    expiresAt:
                        result.expiresAt
                }
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            '[API OnChat Create Status] Error:',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'An internal server error occurred.'
            },
            { status: 500 }
        );
    }
}

/*
 * GET
 *
 * Aucun userId n'est accepté.
 * Le compte est déterminé exclusivement
 * par le Bearer token.
 */
export async function GET(
    request: NextRequest
) {
    try {
        const user =
            await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Authentication required.'
                },
                { status: 401 }
            );
        }

        const statusGroups =
            await getStatusesForUser(
                user.id
            );

        const normalizedGroups =
            statusGroups.map(
                (group: any) => ({
                    ...group,
                    statuses:
                        group.statuses.map(
                            (status: any) => ({
                                ...status,
                                content:
                                    status.content
                                        ? buildPublicUrl(
                                            request,
                                            status.content
                                        )
                                        : status.content
                            })
                        )
                })
            );

        return NextResponse.json({
            success: true,
            statusGroups:
                normalizedGroups
        });
    } catch (error) {
        console.error(
            '[API OnChat GET My Statuses] Error:',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'An internal server error occurred.'
            },
            { status: 500 }
        );
    }
}
