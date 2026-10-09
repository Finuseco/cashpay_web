import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const agent = await getAuthenticatedUser();

        if (!agent) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Authentification requise.',
                },
                { status: 401 }
            );
        }

        if (agent.role !== 'Agent') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Accès réservé aux agents.',
                },
                { status: 403 }
            );
        }

        const { rows } = await db.query(
            `
            SELECT
                u.id,
                u.id_wallet,
                u.full_name,
                u.first_name,
                u.last_name,
                u.profile_photo,
                u.phone,
                u.country,
                u.province,
                u.created_at,
                r.status AS referral_status
            FROM referrals r
            INNER JOIN users u
                ON u.id = r.referred_user_id
            WHERE r.referrer_user_id = $1
              AND u.role = 'Client'
            ORDER BY u.created_at DESC NULLS LAST, u.id DESC
            `,
            [agent.id]
        );

        return NextResponse.json(
            {
                success: true,
                count: rows.length,
                customers: rows.map((customer: any) => ({
                    id: customer.id,
                    id_wallet: customer.id_wallet,
                    full_name:
                        customer.full_name ||
                        [customer.first_name, customer.last_name]
                            .filter(Boolean)
                            .join(' '),
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    avatar: customer.profile_photo || null,
                    phone: customer.phone,
                    country: customer.country,
                    province: customer.province,
                    created_at: customer.created_at,
                    referral: {
                        status: customer.referral_status,
                    },
                })),
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('[AGENT_CUSTOMERS]', error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    'Erreur lors de la récupération des clients.',
            },
            { status: 500 }
        );
    }
}
