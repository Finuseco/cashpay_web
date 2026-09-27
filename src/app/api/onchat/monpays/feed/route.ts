'use server';

import { NextResponse } from 'next/server';

import {
    getActivities,
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
         * On récupère uniquement les pages suivies
         * qui appartiennent au pays de l'utilisateur.
         */
        const { rows: followedCompanies } =
            await db.query(
                `
                SELECT
                    cf.company_id
                FROM company_followers cf
                INNER JOIN monpays_companies mc
                    ON mc.id = cf.company_id
                WHERE cf.user_id = $1
                  AND mc.country = $2
                  AND mc.status = 'verified'
                `,
                [userId, countryCode]
            );

        const followedCompanyIds =
            new Set(
                followedCompanies.map(
                    (row) =>
                        Number(row.company_id)
                )
            );

        if (followedCompanyIds.size === 0) {
            return NextResponse.json({
                success: true,
                countryCode,
                activities: [],
            });
        }

        /*
         * getActivities() récupère les publications
         * publiées et reliées à leur entreprise.
         */
        const activities =
            await getActivities();

        const feed =
            activities.filter(
                (activity) =>
                    followedCompanyIds.has(
                        Number(activity.companyId)
                    )
            );

        return NextResponse.json({
            success: true,

            countryCode,

            activities: feed,
        });
    } catch (error) {
        console.error(
            '[API OnChat MonPays] GET feed:',
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
