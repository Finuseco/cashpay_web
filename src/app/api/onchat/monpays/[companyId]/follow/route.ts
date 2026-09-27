'use server';

import { NextResponse } from 'next/server';

import {
    getCompanyById,
    toggleFollowCompany,
    getCompanyFollowerInfo,
} from '@/lib/actions/monpays.actions';

import { db } from '@/lib/db';
import { countryToCode } from '@/lib/utils';

type RouteContext = {
    params: Promise<{
        companyId: string;
    }>;
};

function getCountryCode(country: unknown): string | null {
    if (!country) return null;

    const value = String(country).trim();

    if (!value) return null;

    return countryToCode(value) || value.toUpperCase();
}

export async function POST(
    request: Request,
    context: RouteContext
) {
    try {
        const body = await request.json();

        const userId = Number(
            body?.userId
        );

        if (!Number.isInteger(userId) || userId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'userId invalide.',
                },
                { status: 400 }
            );
        }

        const { companyId } =
            await context.params;

        const id = Number(companyId);

        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid companyId.',
                },
                { status: 400 }
            );
        }

        /*
         * Pays de l'utilisateur.
         */
        const { rows: userRows } = await db.query(
            `
            SELECT country
            FROM users
            WHERE id = $1
            LIMIT 1
            `,
            [userId]
        );

        if (
            userRows.length === 0 ||
            !userRows[0].country
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Pays de l’utilisateur introuvable.',
                },
                { status: 404 }
            );
        }

        const countryCode =
            getCountryCode(userRows[0].country);

        if (!countryCode) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Code pays de l’utilisateur introuvable.',
                },
                { status: 404 }
            );
        }

        const company =
            await getCompanyById(companyId);

        if (!company) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Company not found.',
                },
                { status: 404 }
            );
        }

        /*
         * L'abonnement est possible uniquement
         * pour une page du même pays.
         */
        if (
            String(company.countryCode || '')
                .toUpperCase() !== countryCode
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Cette page MonPays n’est pas disponible dans le pays de l’utilisateur.',
                },
                { status: 403 }
            );
        }

        if (!company.isVerified) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'This MonPays page is not verified.',
                },
                { status: 403 }
            );
        }

        const result =
            await toggleFollowCompany(
                userId,
                id
            );

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Unable to update subscription.',
                },
                { status: 500 }
            );
        }

        const followerInfo =
            await getCompanyFollowerInfo(
                userId,
                id
            );

        return NextResponse.json({
            success: true,

            userId,

            countryCode,

            companyId: id,

            isFollowing:
                followerInfo.isFollowing,

            followerCount:
                followerInfo.followerCount,
        });
    } catch (error) {
        console.error(
            '[API OnChat MonPays] POST follow:',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'Unable to update subscription.',
            },
            { status: 500 }
        );
    }
}
