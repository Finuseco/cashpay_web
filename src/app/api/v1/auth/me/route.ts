import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateUser } from '@/lib/actions/user.actions';
import { getUserAstroProfile } from '@/lib/actions/astro.actions';
import { verifyCurrentUserPin } from '@/lib/actions/message.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://app.cashpay-all.com';

const DEFAULT_AVATAR_URL =
    `${BASE_URL}/images/avatars/default.jpg`;

const MEDIA_API_URL =
    `${BASE_URL}/api/v1/profile/media`;

const getPublicUrl = (
    path: string | null | undefined
) => {
    if (!path) {
        return null;
    }

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    return `${BASE_URL}${
        path.startsWith('/') ? path : `/${path}`
    }`;
};

const getAvatarUrl = (
    path: string | null | undefined
) => {
    return getPublicUrl(path) || DEFAULT_AVATAR_URL;
};

const findAuthenticatedUser = async (
    userId: number
) => {
    const { rows } = await db.query(
        `
        SELECT
            id,
            role,
            status,
            account_type,
            id_wallet,
            language,
            ussd_language,
            full_name,
            first_name,
            last_name,
            middle_name,
            gender,
            marital_status,
            birth_date,
            birth_place,
            nationality,
            email,
            phone,
            country,
            province,
            city,
            address,
            profession,
            activity_description,
            income_per_month,
            profile_photo,
            cover_photo,
            signature_image,
            google_id,
            zoom_id,
            notifications_channel,
            assistantsettings,
            availabilitystatus,
            schedule,
            representative,
            verification_status,
            temp_photo_expires_at,
            is_crypto_active,
            created_at
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
    );

    return rows.length > 0 ? rows[0] : null;
};

const buildProfile = async (
    user: any
) => {
    let astro = null;

    try {
        astro = await getUserAstroProfile(user.id);
    } catch {
        astro = null;
    }

    return {
        id: user.id,
        role: user.role ?? null,
        status: user.status ?? null,
        accountType: user.account_type ?? null,
        walletId: user.id_wallet ?? null,
        language: user.language ?? null,
        ussdLanguage: user.ussd_language ?? null,
        fullName: user.full_name ?? null,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
        middleName: user.middle_name ?? null,
        gender: user.gender ?? null,
        maritalStatus: user.marital_status ?? null,
        birthDate: user.birth_date ?? null,
        birthPlace: user.birth_place ?? null,
        nationality: user.nationality ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        country: user.country ?? null,
        province: user.province ?? null,
        city: user.city ?? null,
        address: user.address ?? null,
        profession: user.profession ?? null,
        activityDescription:
            user.activity_description ?? null,
        incomePerMonth:
            user.income_per_month ?? null,
        profilePhoto:
            user.profile_photo ?? null,
        profilePhotoUrl:
            getAvatarUrl(user.profile_photo),
        coverPhoto:
            user.cover_photo ?? null,
        coverPhotoUrl:
            getPublicUrl(user.cover_photo),
        signatureImage:
            user.signature_image ?? null,
        googleId:
            user.google_id ?? null,
        zoomId:
            user.zoom_id ?? null,
        notificationsChannel:
            user.notifications_channel ?? null,
        assistantSettings:
            user.assistantsettings ?? null,
        availabilityStatus:
            user.availabilitystatus ?? null,
        schedule:
            user.schedule ?? null,
        representative:
            user.representative ?? null,
        verificationStatus:
            user.verification_status ?? null,
        tempPhotoExpiresAt:
            user.temp_photo_expires_at ?? null,
        isCryptoActive:
            user.is_crypto_active ?? null,
        createdAt:
            user.created_at ?? null,
        astro
    };
};

const buildProfileInstallation = (
    user: any
) => {
    return {
        ready: true,
        userId: user.id,
        walletId: user.id_wallet,
        phone: user.phone,
        avatar: {
            available:
                Boolean(user.profile_photo),
            source:
                user.profile_photo ?? null,
            url:
                getAvatarUrl(user.profile_photo),
            default:
                !user.profile_photo
        },
        cover: {
            available:
                Boolean(user.cover_photo),
            source:
                user.cover_photo ?? null,
            url:
                getPublicUrl(user.cover_photo)
        },
        media: {
            endpoint: MEDIA_API_URL,
            upload: MEDIA_API_URL,
            list: MEDIA_API_URL,
            delete: MEDIA_API_URL,
            setProfile:
                `${MEDIA_API_URL}/set-profile`,
            setCover:
                `${MEDIA_API_URL}/set-cover`
        }
    };
};

const getAuthenticatedProfile = async () => {
    const authenticatedUser =
        await getAuthenticatedUser();

    if (!authenticatedUser) {
        return {
            error: NextResponse.json(
                {
                    success: false,
                    error:
                        'Authentification requise.'
                },
                {
                    status: 401
                }
            )
        };
    }

    const userId =
        Number(authenticatedUser.id);

    if (
        !Number.isInteger(userId) ||
        userId <= 0
    ) {
        return {
            error: NextResponse.json(
                {
                    success: false,
                    error:
                        'Identité authentifiée invalide.'
                },
                {
                    status: 401
                }
            )
        };
    }

    const user =
        await findAuthenticatedUser(userId);

    if (!user) {
        return {
            error: NextResponse.json(
                {
                    success: false,
                    error:
                        'Utilisateur introuvable.'
                },
                {
                    status: 404
                }
            )
        };
    }

    return {
        user,
        userId
    };
};

export async function GET(
    _request: NextRequest
) {
    try {
        const result =
            await getAuthenticatedProfile();

        if ('error' in result) {
            return result.error;
        }

        const { user } = result;

        return NextResponse.json({
            success: true,
            found: true,
            profileInstallation:
                buildProfileInstallation(user),
            profile:
                await buildProfile(user)
        });
    } catch (error) {
        console.error(
            '[API V1 AUTH ME GET]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'Impossible d’installer le profil.'
            },
            {
                status: 500
            }
        );
    }
}

export async function PATCH(
    request: NextRequest
) {
    try {
        const result =
            await getAuthenticatedProfile();

        if ('error' in result) {
            return result.error;
        }

        const { user } = result;

        const body =
            await request.json();

        const pin =
            String(body.pin || '');

        const requestedUpdates =
            body.updates &&
            typeof body.updates === 'object'
                ? {
                    ...body.updates
                }
                : {};

        if (!pin) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Code PIN requis pour modifier les données.'
                },
                {
                    status: 400
                }
            );
        }

        if (
            Object.keys(
                requestedUpdates
            ).length === 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Aucune donnée à modifier.'
                },
                {
                    status: 400
                }
            );
        }

        const imageFields = [
            'profile_photo',
            'cover_photo'
        ];

        const imageUpdateRequested =
            imageFields.some(
                (field) =>
                    Object.prototype.hasOwnProperty.call(
                        requestedUpdates,
                        field
                    )
            );

        if (imageUpdateRequested) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Les images du profil doivent être gérées par l’API média.',
                    media: {
                        endpoint:
                            MEDIA_API_URL,
                        upload:
                            MEDIA_API_URL,
                        setProfile:
                            `${MEDIA_API_URL}/set-profile`,
                        setCover:
                            `${MEDIA_API_URL}/set-cover`
                    }
                },
                {
                    status: 400
                }
            );
        }

        const pinValid =
            await verifyCurrentUserPin(
                user.id,
                pin
            );

        if (!pinValid) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Code PIN incorrect.'
                },
                {
                    status: 403
                }
            );
        }

        const resultUpdate =
            await updateUser({
                userId: user.id,
                updates: requestedUpdates
            });

        if (!resultUpdate.success) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        resultUpdate.error ||
                        'Impossible de mettre à jour le profil.'
                },
                {
                    status: 400
                }
            );
        }

        const updatedUser =
            await findAuthenticatedUser(
                user.id
            );

        if (!updatedUser) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Profil mis à jour mais impossible de récupérer le profil.'
                },
                {
                    status: 500
                }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                'Profil mis à jour.',
            profileInstallation:
                buildProfileInstallation(
                    updatedUser
                ),
            profile:
                await buildProfile(
                    updatedUser
                )
        });
    } catch (error) {
        console.error(
            '[API V1 AUTH ME PATCH]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'Impossible de mettre à jour le profil.'
            },
            {
                status: 500
            }
        );
    }
}
