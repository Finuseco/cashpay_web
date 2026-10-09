import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { countries } from '@/lib/countries';
import { PROVINCES_BY_COUNTRY } from '@/lib/provinces';

export async function GET() {
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

        const agentCountryValue = String(agent.country || '').trim();

        const agentCountry =
            countries.find(
                country =>
                    String(country.code).toLowerCase() ===
                    agentCountryValue.toLowerCase()
            ) ||
            countries.find(
                country =>
                    String(country.name).trim().toLowerCase() ===
                    agentCountryValue.toLowerCase()
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

        const countryCode = String(agentCountry.code).toUpperCase();

        const provinceNames =
            PROVINCES_BY_COUNTRY[
                countryCode as keyof typeof PROVINCES_BY_COUNTRY
            ] || [];

        return NextResponse.json(
            {
                success: true,

                country: {
                    code: agentCountry.code,
                    name: agentCountry.name,
                    dial_code: agentCountry.dial_code,
                    currency_code: agentCountry.currency_code || null,
                },

                provinces: provinceNames.map(name => ({
                    code: name,
                    name,
                })),

                options: {
                    account_type: [
                        {
                            value: 'national',
                            label: 'National',
                        },
                        {
                            value: 'diaspora',
                            label: 'Diaspora',
                        },
                        {
                            value: 'business',
                            label: 'Business',
                        },
                    ],

                    gender: [
                        {
                            value: 'male',
                            label: 'Masculin',
                        },
                        {
                            value: 'female',
                            label: 'Féminin',
                        },
                        {
                            value: 'other',
                            label: 'Autre',
                        },
                    ],

                    marital_status: [
                        {
                            value: 'single',
                            label: 'Célibataire',
                        },
                        {
                            value: 'married',
                            label: 'Marié(e)',
                        },
                        {
                            value: 'divorced',
                            label: 'Divorcé(e)',
                        },
                        {
                            value: 'widowed',
                            label: 'Veuf(ve)',
                        },
                    ],

                    language: [
                        {
                            value: 'fr',
                            label: 'Français',
                        },
                        {
                            value: 'en',
                            label: 'English',
                        },
                        {
                            value: 'es',
                            label: 'Español',
                        },
                        {
                            value: 'pt',
                            label: 'Português',
                        },
                        {
                            value: 'it',
                            label: 'Italiano',
                        },
                        {
                            value: 'ru',
                            label: 'Русский',
                        },
                        {
                            value: 'zh',
                            label: '中文',
                        },
                        {
                            value: 'hi',
                            label: 'हिन्दी',
                        },
                        {
                            value: 'sw',
                            label: 'Kiswahili',
                        },
                        {
                            value: 'ln',
                            label: 'Lingála',
                        },
                        {
                            value: 'ar',
                            label: 'العربية',
                        },
                    ],

                    ussd_language: [
                        {
                            value: 'fr',
                            label: 'Français',
                        },
                        {
                            value: 'en',
                            label: 'English',
                        },
                    ],

                    id_type: [
                        {
                            value: 'passport',
                            label: 'Passeport',
                        },
                        {
                            value: 'national_id',
                            label: 'Carte d’identité nationale',
                        },
                        {
                            value: 'driver_license',
                            label: 'Permis de conduire',
                        },
                    ],

                    representative_relation: [
                        {
                            value: 'parent',
                            label: 'Parent',
                        },
                        {
                            value: 'sibling',
                            label: 'Frère / Sœur',
                        },
                        {
                            value: 'spouse',
                            label: 'Conjoint(e)',
                        },
                        {
                            value: 'other',
                            label: 'Autre',
                        },
                    ],
                },
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('[AGENT_CUSTOMER_OPTIONS]', error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    'Erreur lors de la récupération des options.',
            },
            { status: 500 }
        );
    }
}


