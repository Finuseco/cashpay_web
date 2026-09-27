'use server';

import { NextResponse } from 'next/server';

import {
    getCompanyById,
    getActivities,
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

export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        const { searchParams } =
            new URL(request.url);

        const userId = Number(
            searchParams.get('userId')
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

        /*
         * Page MonPays demandée.
         */
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
         * Une page appartenant à un autre pays
         * n'est pas visible dans le MonPays courant.
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
                { status: 404 }
            );
        }

        const followerInfo =
            await getCompanyFollowerInfo(
                userId,
                id
            );

        /*
         * Les activités sont déjà reliées à la page
         * par monpays_posts.author_company_id.
         */
        const activities =
            await getActivities();

        const companyActivities =
            activities.filter(
                (activity) =>
                    Number(activity.companyId) === id
            );

        return NextResponse.json({
            success: true,

            countryCode,

            company: {
                ...company,

                followerCount:
                    followerInfo.followerCount,

                isFollowing:
                    followerInfo.isFollowing,
            },

            activities:
                companyActivities,
        });
    } catch (error) {
        console.error(
            '[API OnChat MonPays] GET company:',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'An internal server error occurred.',
            },
            { status: 500 }
        );
    }
}
