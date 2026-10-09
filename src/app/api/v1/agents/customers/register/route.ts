import { NextRequest, NextResponse } from 'next/server';
import {
    getAuthenticatedUser,
    registerUser,
} from '@/lib/actions/user.actions';
import { db } from '@/lib/db';
import { countries } from '@/lib/countries';
import { PROVINCES_BY_COUNTRY } from '@/lib/provinces';

function normalizePhone(phone: string): string {
    return String(phone || '')
        .trim()
        .replace(/[^0-9]/g, '');
}

function getCountryByAgent(agentCountry: string) {
    const value = String(agentCountry || '').trim().toLowerCase();

    return (
        countries.find(
            c => String(c.code).toLowerCase() === value
        ) ||
        countries.find(
            c => String(c.name).trim().toLowerCase() === value
        ) ||
        null
    );
}

export async function POST(request: NextRequest) {
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

        const agentCountry = getCountryByAgent(
            String(agent.country || '')
        );

        if (!agentCountry) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Pays de l’agent introuvable.',
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const phone = normalizePhone(body.phone);

        if (!phone) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Le numéro de téléphone est obligatoire.',
                },
                { status: 400 }
            );
        }

        const dialCode = String(agentCountry.dial_code || '')
            .replace(/[^0-9]/g, '');

        if (dialCode && !phone.startsWith(dialCode)) {
            return NextResponse.json(
                {
                    success: false,
                    code: 'PHONE_COUNTRY_MISMATCH',
                    error: `Le numéro doit appartenir au pays de l’agent (${agentCountry.name}).`,
                },
                { status: 400 }
            );
        }

        const { rows: phoneRows } = await db.query(
            `
            SELECT id, id_wallet, full_name
            FROM users
            WHERE regexp_replace(
                COALESCE(phone, ''),
                '[^0-9]',
                '',
                'g'
            ) = $1
            LIMIT 1
            `,
            [phone]
        );

        if (phoneRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    code: 'PHONE_ALREADY_EXISTS',
                    error: 'Ce numéro de téléphone est déjà associé à un compte CashPay.',
                    existing_customer: {
                        id_wallet: phoneRows[0].id_wallet,
                        full_name: phoneRows[0].full_name,
                    },
                },
                { status: 409 }
            );
        }

        const email = body.email
            ? String(body.email).trim().toLowerCase()
            : null;

        if (email) {
            const { rows: emailRows } = await db.query(
                `
                SELECT id, id_wallet, full_name
                FROM users
                WHERE LOWER(TRIM(email)) = $1
                LIMIT 1
                `,
                [email]
            );

            if (emailRows.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        code: 'EMAIL_ALREADY_EXISTS',
                        error: 'Cette adresse email est déjà associée à un compte CashPay.',
                    },
                    { status: 409 }
                );
            }
        }

        const idType = String(body.id_type || '').trim();
        const idNumber = String(body.id_number || '').trim();

        if (!idType || !idNumber) {
            return NextResponse.json(
                {
                    success: false,
                    code: 'ID_DOCUMENT_REQUIRED',
                    error: 'Le type et le numéro de la pièce d’identité sont obligatoires.',
                },
                { status: 400 }
            );
        }

        const { rows: documentRows } = await db.query(
            `
            SELECT
                ud.user_id,
                ud.id_number,
                u.id_wallet,
                u.full_name
            FROM user_documents ud
            JOIN users u ON u.id = ud.user_id
            WHERE LOWER(TRIM(ud.id_type)) = LOWER(TRIM($1))
              AND LOWER(TRIM(ud.id_number)) = LOWER(TRIM($2))
            LIMIT 1
            `,
            [idType, idNumber]
        );

        if (documentRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    code: 'ID_DOCUMENT_ALREADY_EXISTS',
                    error: 'Cette pièce d’identité est déjà associée à un compte CashPay.',
                    existing_customer: {
                        id_wallet: documentRows[0].id_wallet,
                        full_name: documentRows[0].full_name,
                    },
                },
                { status: 409 }
            );
        }

        const province = String(body.province || '').trim();

        const countryProvinces =
            PROVINCES_BY_COUNTRY[
                agentCountry.code.toUpperCase() as keyof typeof PROVINCES_BY_COUNTRY
            ] || [];

        if (!countryProvinces.includes(province)) {
            return NextResponse.json(
                {
                    success: false,
                    code: 'INVALID_PROVINCE',
                    error: 'La province ne correspond pas au pays de l’agent.',
                },
                { status: 400 }
            );
        }

        const registrationData = {
            ...body,
            role: 'Client',
            phone,
            email,
            country: agentCountry.name,
            countryCode: agentCountry.code,
            province,
            referralCode: agent.id_wallet,
            skipOtp: true,
            skipEmailVerification: true,
            createdByAgent: true,
        };

        const result = await registerUser(registrationData);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                },
                { status: 400 }
            );
        }

        const customer = result.user as any;

        return NextResponse.json(
            {
                success: true,
                code: 'CUSTOMER_CREATED',
                message: 'Compte Client créé avec succès.',
                customer: {
                    id: customer.id,
                    id_wallet: result.id_wallet,
                    full_name:
                        customer.full_name ||
                        [customer.first_name, customer.last_name]
                            .filter(Boolean)
                            .join(' '),
                    first_name: customer.first_name || null,
                    last_name: customer.last_name || null,
                    avatar:
                        customer.profile_photo ||
                        customer.avatar ||
                        null,
                    phone: customer.phone || phone,
                    country: customer.country || agentCountry.name,
                    countryCode:
                        customer.countryCode ||
                        customer.country_code ||
                        agentCountry.code,
                    province: customer.province || province,
                    created_at: customer.created_at || new Date().toISOString(),
                },
                referral: {
                    enabled: true,
                    referrer_id: agent.id,
                    referrer_id_wallet: agent.id_wallet,
                    status: 'Pending Deposit',
                },
                created_by: {
                    id: agent.id,
                    id_wallet: agent.id_wallet,
                    full_name: agent.full_name || null,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('[AGENT_CUSTOMER_REGISTER]', error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    'Erreur lors de la création du compte.',
            },
            { status: 500 }
        );
    }
}
