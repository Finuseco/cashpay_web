import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserAstroProfile } from '@/lib/actions/astro.actions';
import { getAgentBoutiques } from '@/lib/actions/agent.actions';

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
    let digits = phone.replace(/\D/g, '');

    if (digits.startsWith('243')) {
        digits = digits.slice(3);
    }

    if (digits.startsWith('0')) {
        digits = digits.slice(1);
    }

    if (digits.length !== 9) {
        return null;
    }

    return digits;
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

        let boutiques = [];
        if (String(user.role || '').toLowerCase() === 'agent') {
            try {
                boutiques = await getAgentBoutiques(user.id);
            } catch {
                boutiques = [];
            }
        }

        let astro = null;

        try {
            astro = await getUserAstroProfile(user.id);
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
                [user.id]
            );

            if (bitcoinRows.length > 0) {
                bitcoinAddress =
                    bitcoinRows[0].address || null;
            }
        } catch (error) {
            console.error(
                '[API PROFILE BY PHONE] Bitcoin address error:',
                error
            );
        }

        return NextResponse.json({
            success: true,
            found: true,
            profile: {
                walletId: user.id_wallet,
                fullName: user.full_name,
                role: user.role ?? null,
                boutiques: boutiques.map((boutique: any) => ({
                    id: boutique.id,
                    name: boutique.name,
                    address: boutique.address ?? null
                })),
                profilePhoto: user.profile_photo ?? null,
                profilePhotoUrl:
                    getPublicUrl(user.profile_photo),
                coverPhoto: user.cover_photo ?? null,
                coverPhotoUrl:
                    getPublicUrl(user.cover_photo),
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
                astro,
                bitcoin: {
                    available: Boolean(bitcoinAddress),
                    address: bitcoinAddress
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
