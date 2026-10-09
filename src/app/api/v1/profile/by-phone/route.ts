import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserAstroProfile } from '@/lib/actions/astro.actions';
import { getAgentBoutiques } from '@/lib/actions/agent.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

const getPublicUrl = (path: string | null | undefined) => {
    if (!path) return null;

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    return `https://app.cashpay-all.com${
        path.startsWith('/') ? path : `/${path}`
    }`;
};

const normalizePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');

    if (digits.length < 9) {
        return null;
    }

    return digits.slice(-9);
};

const getOptionalAuthenticatedUser = async () => {
    try {
        return await getAuthenticatedUser();
    } catch {
        return null;
    }
};

export async function GET(request: NextRequest) {
    try {
        const phone = request.nextUrl.searchParams.get('phone');

        if (!phone) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Le paramètre phone est obligatoire.'
                },
                { status: 400 }
            );
        }

        const normalizedPhone = normalizePhone(phone);

        if (!normalizedPhone) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Le numéro doit être fourni avec ou sans le 0 national, avec 243, +243 ou directement avec les 9 chiffres.'
                },
                { status: 400 }
            );
        }

        const { rows } = await db.query(
            `
            SELECT
                id,
                role,
                id_wallet,
                full_name,
                first_name,
                last_name,
                profession,
                activity_description,
                address,
                city,
                province,
                country,
                birth_date,
                nationality,
                language,
                profile_photo,
                cover_photo,
                verification_status,
                created_at
            FROM users
            WHERE RIGHT(
                REGEXP_REPLACE(phone, '[^0-9]', '', 'g'),
                9
            ) = $1
            LIMIT 1
            `,
            [normalizedPhone]
        );

        if (rows.length === 0) {
            return NextResponse.json({
                success: true,
                found: false,
                profile: null
            });
        }

        const user = rows[0];
        const userId = Number(user.id);

        const authenticatedUser =
            await getOptionalAuthenticatedUser();

        const viewerId =
            authenticatedUser?.id != null
                ? Number(authenticatedUser.id)
                : null;

        let boutiques: any[] = [];

        if (String(user.role || '').toLowerCase() === 'agent') {
            try {
                boutiques = await getAgentBoutiques(userId);
            } catch {
                boutiques = [];
            }
        }

        let astro = null;

        try {
            astro = await getUserAstroProfile(userId);
        } catch {
            astro = null;
        }

        let bitcoinAddress: string | null = null;

        try {
            const { rows: bitcoinRows } = await db.query(
                `
                SELECT
                    address
                FROM user_crypto_addresses
                WHERE user_id = $1
                  AND currency_code = 'BTC'
                ORDER BY id DESC
                LIMIT 1
                `,
                [userId]
            );

            if (bitcoinRows.length > 0) {
                bitcoinAddress = bitcoinRows[0].address || null;
            }
        } catch (error) {
            console.error(
                '[API PROFILE BY PHONE] Bitcoin address error:',
                error
            );
        }

        let followers: any[] = [];
        let following: any[] = [];
        let followerCount = 0;
        let followingCount = 0;
        let isFollowing = false;
        let isFollowedBy = false;

        try {
            const { rows: followerRows } = await db.query(
                `
                SELECT
                    uf.follower_user_id AS "userId",
                    u.id_wallet AS "walletId",
                    u.full_name AS "fullName",
                    u.first_name AS "firstName",
                    u.last_name AS "lastName",
                    u.profile_photo AS "profilePhoto",
                    u.cover_photo AS "coverPhoto",
                    uf.created_at AS "followedAt"
                FROM user_followers uf
                INNER JOIN users u
                    ON u.id = uf.follower_user_id
                WHERE uf.followed_user_id = $1
                ORDER BY uf.created_at DESC, uf.id DESC
                `,
                [userId]
            );

            followers = followerRows.map((item: any) => ({
                userId: Number(item.userId),
                walletId: item.walletId ?? null,
                fullName: item.fullName ?? null,
                firstName: item.firstName ?? null,
                lastName: item.lastName ?? null,
                profilePhoto: item.profilePhoto ?? null,
                profilePhotoUrl: getPublicUrl(item.profilePhoto),
                coverPhoto: item.coverPhoto ?? null,
                coverPhotoUrl: getPublicUrl(item.coverPhoto),
                followedAt: item.followedAt ?? null
            }));

            followerCount = followers.length;

            const { rows: followingRows } = await db.query(
                `
                SELECT
                    uf.followed_user_id AS "userId",
                    u.id_wallet AS "walletId",
                    u.full_name AS "fullName",
                    u.first_name AS "firstName",
                    u.last_name AS "lastName",
                    u.profile_photo AS "profilePhoto",
                    u.cover_photo AS "coverPhoto",
                    uf.created_at AS "followedAt"
                FROM user_followers uf
                INNER JOIN users u
                    ON u.id = uf.followed_user_id
                WHERE uf.follower_user_id = $1
                ORDER BY uf.created_at DESC, uf.id DESC
                `,
                [userId]
            );

            following = followingRows.map((item: any) => ({
                userId: Number(item.userId),
                walletId: item.walletId ?? null,
                fullName: item.fullName ?? null,
                firstName: item.firstName ?? null,
                lastName: item.lastName ?? null,
                profilePhoto: item.profilePhoto ?? null,
                profilePhotoUrl: getPublicUrl(item.profilePhoto),
                coverPhoto: item.coverPhoto ?? null,
                coverPhotoUrl: getPublicUrl(item.coverPhoto),
                followedAt: item.followedAt ?? null
            }));

            followingCount = following.length;

            if (viewerId !== null && viewerId !== userId) {
                const { rows: relationshipRows } =
                    await db.query(
                        `
                        SELECT
                            EXISTS (
                                SELECT 1
                                FROM user_followers
                                WHERE follower_user_id = $1
                                  AND followed_user_id = $2
                            ) AS "isFollowing",
                            EXISTS (
                                SELECT 1
                                FROM user_followers
                                WHERE follower_user_id = $2
                                  AND followed_user_id = $1
                            ) AS "isFollowedBy"
                        `,
                        [viewerId, userId]
                    );

                isFollowing = Boolean(
                    relationshipRows[0]?.isFollowing
                );

                isFollowedBy = Boolean(
                    relationshipRows[0]?.isFollowedBy
                );
            }
        } catch (error) {
            console.error(
                '[API PROFILE BY PHONE] Followers error:',
                error
            );
        }

        const { rows: mediaRows } = await db.query(
            `
            SELECT
                m.id,
                m.owner_type,
                m.owner_id,
                m.media_type,
                m.file_name,
                m.file_path,
                m.file_url,
                m.mime_type,
                m.file_size,
                m.visibility,
                m.created_at,
                m.updated_at,
                m.expires_at,
                m.duration_seconds,
                m.thumbnail_url,
                (
                    SELECT COUNT(*)::integer
                    FROM media_likes ml
                    WHERE ml.media_id = m.id
                ) AS like_count,
                (
                    SELECT COUNT(*)::integer
                    FROM media_comments mc
                    WHERE mc.media_id = m.id
                ) AS comment_count,
                CASE
                    WHEN $2::integer IS NULL THEN false
                    ELSE EXISTS (
                        SELECT 1
                        FROM media_likes ml2
                        WHERE ml2.media_id = m.id
                          AND ml2.user_id = $2
                    )
                END AS liked_by_me
            FROM media m
            WHERE m.owner_type = 'user'
              AND m.owner_id = $1
              AND m.visibility = 'public'
              AND (
                    m.expires_at IS NULL
                    OR m.expires_at > NOW()
              )
              AND m.media_type IN (
                    'profile',
                    'cover',
                    'image',
                    'album_image',
                    'video'
              )
            ORDER BY m.created_at DESC, m.id DESC
            `,
            [userId, viewerId]
        );

        const media = mediaRows.map((item: any) => ({
            id: Number(item.id),
            ownerType: item.owner_type,
            ownerId: Number(item.owner_id),
            mediaType: item.media_type,
            fileName: item.file_name ?? null,
            filePath: item.file_path ?? null,
            fileUrl:
                getPublicUrl(item.file_url) ||
                getPublicUrl(item.file_path),
            mimeType: item.mime_type ?? null,
            fileSize:
                item.file_size != null
                    ? Number(item.file_size)
                    : null,
            visibility: item.visibility,
            createdAt: item.created_at ?? null,
            updatedAt: item.updated_at ?? null,
            expiresAt: item.expires_at ?? null,
            durationSeconds:
                item.duration_seconds != null
                    ? Number(item.duration_seconds)
                    : null,
            thumbnailUrl: getPublicUrl(item.thumbnail_url),
            likeCount: Number(item.like_count || 0),
            commentCount: Number(item.comment_count || 0),
            likedByMe: Boolean(item.liked_by_me)
        }));

        const publicPhotos = media.filter(
            (item) =>
                item.mediaType === 'image' ||
                item.mediaType === 'album_image'
        );

        const publicVideos = media.filter(
            (item) => item.mediaType === 'video'
        );

        const profileMedia = media.filter(
            (item) => item.mediaType === 'profile'
        );

        const coverMedia = media.filter(
            (item) => item.mediaType === 'cover'
        );

        const albumMap = new Map<
            number,
            {
                albumId: number;
                media: any[];
            }
        >();

        for (const item of media) {
            if (item.mediaType !== 'album_image') {
                continue;
            }

            const albumId = item.ownerId;

            if (!albumMap.has(albumId)) {
                albumMap.set(albumId, {
                    albumId,
                    media: []
                });
            }

            albumMap.get(albumId)!.media.push(item);
        }

        const albums = Array.from(albumMap.values()).map(
            (album) => ({
                id: album.albumId,
                mediaCount: album.media.length,
                cover:
                    album.media.length > 0
                        ? album.media[0].fileUrl
                        : null,
                media: album.media
            })
        );

        const totalLikes = media.reduce(
            (total, item) => total + item.likeCount,
            0
        );

        const totalComments = media.reduce(
            (total, item) => total + item.commentCount,
            0
        );

        return NextResponse.json({
            success: true,
            found: true,
            profile: {
                userId,
                walletId: user.id_wallet,
                fullName: user.full_name,
                firstName: user.first_name ?? null,
                lastName: user.last_name ?? null,
                role: user.role ?? null,
                profilePhoto: user.profile_photo ?? null,
                profilePhotoUrl: getPublicUrl(user.profile_photo),
                coverPhoto: user.cover_photo ?? null,
                coverPhotoUrl: getPublicUrl(user.cover_photo),
                profession: user.profession ?? null,
                activityDescription:
                    user.activity_description ?? null,
                birthDate: user.birth_date ?? null,
                nationality: user.nationality ?? null,
                language: user.language ?? null,
                address: user.address ?? null,
                city: user.city ?? null,
                province: user.province ?? null,
                country: user.country ?? null,
                verificationStatus:
                    user.verification_status ?? null,
                createdAt: user.created_at ?? null,

                boutiques: boutiques.map((boutique: any) => ({
                    id: boutique.id,
                    name: boutique.name,
                    address: boutique.address ?? null
                })),

                astro,

                bitcoin: {
                    available: Boolean(bitcoinAddress),
                    address: bitcoinAddress
                },

                viewer: {
                    authenticated: Boolean(viewerId),
                    isOwner:
                        viewerId !== null &&
                        viewerId === userId
                },

                media: {
                    total: media.length,
                    photos: publicPhotos.length,
                    videos: publicVideos.length,
                    profile: profileMedia,
                    cover: coverMedia,
                    items: media
                },

                albums,

                engagement: {
                    totalLikes,
                    totalComments
                },

                followers: {
                    count: followerCount,
                    items: followers
                },

                following: {
                    count: followingCount,
                    items: following
                },

                relationship: {
                    isFollowing,
                    isFollowedBy
                }
            }
        });
    } catch (error) {
        console.error(
            '[API PROFILE BY PHONE]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: 'Impossible de rechercher ce profil.'
            },
            { status: 500 }
        );
    }
}
