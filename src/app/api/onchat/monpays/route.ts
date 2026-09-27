'use server';

import { NextResponse } from 'next/server';
import {
    getCompanies,
    getCompanyFollowerInfo,
} from '@/lib/actions/monpays.actions';
import { db } from '@/lib/db';
import { countryToCode } from '@/lib/utils';

function getCountryCode(country: unknown): string | null {
    if (!country) return null;

    const value = String(country).trim();

    if (!value) return null;

    return countryToCode(value) || value.toUpperCase();
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

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

        /*
         * Le userId permet de déterminer le pays
         * dans lequel l'utilisateur utilise MonPays.
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
         * getCompanies() récupère uniquement les entreprises
         * MonPays vérifiées.
         *
         * On limite ensuite la réponse au pays de l'utilisateur.
         */
        const companies = await getCompanies();

        const countryCompanies =
            companies.filter(
                (company) =>
                    String(company.countryCode || '')
                        .toUpperCase() === countryCode
            );

        const companiesWithSubscription =
            await Promise.all(
                countryCompanies.map(
                    async (company) => {
                        const followerInfo =
                            await getCompanyFollowerInfo(
                                userId,
                                Number(company.id)
                            );

                        return {
                            ...company,

                            followerCount:
                                followerInfo.followerCount,

                            isFollowing:
                                followerInfo.isFollowing,
                        };
                    }
                )
            );

        return NextResponse.json({
            success: true,

            countryCode,

            companies:
                companiesWithSubscription,
        });
    } catch (error) {
        console.error(
            '[API OnChat MonPays] GET companies:',
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
