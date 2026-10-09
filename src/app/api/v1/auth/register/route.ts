import { NextResponse } from 'next/server';
import {
    checkAvailability,
    sendEmailOtp,
    verifyEmailOtp,
    registerNewAccount,
} from '@/lib/actions/signin.actions';
import {
    checkExistingUser,
    sendRegistrationOtp,
    verifyRegistrationOtp,
} from '@/lib/actions/auth.actions';

type RegisterAction =
    | 'start'
    | 'verify_phone'
    | 'send_email_otp'
    | 'verify_email'
    | 'complete';

const ACCOUNT_TYPES = ['national', 'diaspora', 'business'] as const;

const LANGUAGES = [
    'en',
    'fr',
    'es',
    'pt',
    'it',
    'ru',
    'zh',
    'hi',
    'sw',
    'ln',
    'ar',
] as const;

const GENDERS = ['male', 'female', 'other'] as const;

const MARITAL_STATUSES = [
    'single',
    'married',
    'divorced',
    'widowed',
] as const;

function cleanString(value: unknown): string | null {
    if (value === undefined || value === null) return null;

    const result = String(value).trim();

    return result === '' ? null : result;
}

function normalizeEmail(value: unknown): string | null {
    const email = cleanString(value);

    if (!email) return null;

    return email.toLowerCase();
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAllowed(
    value: unknown,
    values: readonly string[]
): boolean {
    return typeof value === 'string' && values.includes(value);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const action = cleanString(body?.action) as RegisterAction | null;

        if (!action) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Action requise.',
                },
                { status: 400 }
            );
        }

        /*
         * ============================================================
         * START
         * ============================================================
         *
         * Cette étape ne crée aucun compte.
         *
         * Le téléphone doit être vérifié par le mécanisme téléphone
         * existant de l'application.
         *
         * La route ne reconstruit pas le numéro et ne déduit pas
         * elle-même le pays.
         */
        if (action === 'start') {
            const phone = cleanString(body?.phone);
            const preferredOtpChannel = cleanString(body?.preferred_otp_channel);

            if (!phone || !preferredOtpChannel) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Téléphone et canal OTP requis.',
                    },
                    { status: 400 }
                );
            }

            if (!isAllowed(preferredOtpChannel, ['sms', 'whatsapp'])) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Canal OTP invalide. Utilisez sms ou whatsapp.',
                    },
                    { status: 400 }
                );
            }

            const { exists } = await checkExistingUser(phone);

            if (exists) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Ce numéro est déjà associé à un compte.',
                        code: 'PHONE_ALREADY_REGISTERED',
                    },
                    { status: 409 }
                );
            }

            const otpResult = await sendRegistrationOtp(
                phone,
                preferredOtpChannel as 'sms' | 'whatsapp'
            );

            if (!otpResult.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error: otpResult.error || "L'envoi de l'OTP a échoué.",
                        code: 'OTP_SEND_FAILED',
                    },
                    { status: 502 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'start',
                phone,
                otpSent: true,
                next: 'verify_phone',
            });
        }

        if (action === 'verify_phone') {
            const phone = cleanString(body?.phone);
            const otp = cleanString(body?.otp);

            if (!phone || !otp) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Téléphone et code OTP requis.',
                    },
                    { status: 400 }
                );
            }

            const result = await verifyRegistrationOtp(phone, otp);

            if (!result.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error: result.error,
                        code: 'INVALID_PHONE_OTP',
                    },
                    { status: 401 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'verify_phone',
                phone,
                phoneVerified: true,
                next: 'profile',
            });
        }

        if (action === 'send_email_otp') {
            const email = normalizeEmail(body?.email);

            if (!email || !isValidEmail(email)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Adresse e-mail invalide.',
                    },
                    { status: 400 }
                );
            }

            const availability = await checkAvailability(
                'email',
                email
            );

            if (!availability.available) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            availability.error ||
                            'Cette adresse e-mail est déjà utilisée.',
                    },
                    { status: 409 }
                );
            }

            const result = await sendEmailOtp(email);

            if (!result.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            result.error ||
                            "Impossible d'envoyer l'OTP e-mail.",
                    },
                    { status: 502 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'send_email_otp',
                email,
                emailVerificationRequired: true,
                next: 'verify_email',
            });
        }

        /*
         * ============================================================
         * VERIFY EMAIL
         * ============================================================
         */
        if (action === 'verify_email') {
            const email = normalizeEmail(body?.email);
            const otp = cleanString(body?.otp);

            if (!email || !otp) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'E-mail et OTP requis.',
                    },
                    { status: 400 }
                );
            }

            const result = await verifyEmailOtp(email, otp);

            if (!result.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error: result.error,
                    },
                    { status: 401 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'verify_email',
                email,
                emailVerified: true,
                next: 'complete',
            });
        }

        /*
         * ============================================================
         * COMPLETE
         * ============================================================
         */
        if (action === 'complete') {
            const phone = cleanString(body?.phone);
            const countryCode = cleanString(body?.countryCode);
            const country = cleanString(body?.country);
            const accountType = cleanString(body?.account_type);

            if (!phone || !countryCode || !country) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'Téléphone, code pays et pays sont requis.',
                    },
                    { status: 400 }
                );
            }

            if (!accountType) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Type de compte requis.',
                    },
                    { status: 400 }
                );
            }

            if (!isAllowed(accountType, ACCOUNT_TYPES)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Type de compte invalide.',
                    },
                    { status: 400 }
                );
            }

            const email = normalizeEmail(body?.email);

            if (email) {
                if (!isValidEmail(email)) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: 'Adresse e-mail invalide.',
                        },
                        { status: 400 }
                    );
                }

                const availability = await checkAvailability(
                    'email',
                    email
                );

                if (!availability.available) {
                    return NextResponse.json(
                        {
                            success: false,
                            error:
                                availability.error ||
                                'Cette adresse e-mail est déjà utilisée.',
                        },
                        { status: 409 }
                    );
                }
            }

            if (
                body?.language !== undefined &&
                !isAllowed(body.language, LANGUAGES)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Langue invalide.',
                    },
                    { status: 400 }
                );
            }

            if (
                body?.gender !== undefined &&
                body?.gender !== null &&
                !isAllowed(body.gender, GENDERS)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Genre invalide.',
                    },
                    { status: 400 }
                );
            }

            if (
                body?.marital_status !== undefined &&
                body?.marital_status !== null &&
                !isAllowed(
                    body.marital_status,
                    MARITAL_STATUSES
                )
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'État civil invalide.',
                    },
                    { status: 400 }
                );
            }

            /*
             * On ne transmet pas tout le body.
             *
             * On construit explicitement uniquement les champs que
             * registerNewAccount() utilise réellement.
             */
            const registrationData = {
                phone,
                countryCode,
                country,

                account_type: accountType,

                language:
                    cleanString(body?.language) || 'fr',

                company_name:
                    cleanString(body?.company_name),

                first_name:
                    cleanString(body?.first_name),

                last_name:
                    cleanString(body?.last_name),

                middle_name:
                    cleanString(body?.middle_name),

                gender:
                    cleanString(body?.gender),

                birth_date:
                    cleanString(body?.birth_date),

                marital_status:
                    cleanString(body?.marital_status),

                nationality:
                    cleanString(body?.nationality),

                email,

                city:
                    cleanString(body?.city),

                address:
                    cleanString(body?.address),

                profession:
                    cleanString(body?.profession),

                profile_photo:
                    body?.profile_photo ?? null,

                signature_image:
                    body?.signature_image ?? null,

                representative:
                    body?.representative ?? null,

                id_type:
                    cleanString(body?.id_type),

                id_number:
                    cleanString(body?.id_number),

                id_front_image:
                    body?.id_front_image ?? null,
            };

            /*
             * Vérification de disponibilité du numéro de pièce
             * uniquement lorsqu'un numéro est fourni.
             */
            if (registrationData.id_number) {
                const availability = await checkAvailability(
                    'id_number',
                    registrationData.id_number
                );

                if (!availability.available) {
                    return NextResponse.json(
                        {
                            success: false,
                            error:
                                availability.error ||
                                'Ce numéro de pièce est déjà utilisé.',
                        },
                        { status: 409 }
                    );
                }
            }

            const result =
                await registerNewAccount(registrationData);

            return NextResponse.json(
                result,
                {
                    status: result.success ? 201 : 400,
                }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Action inconnue.',
            },
            { status: 400 }
        );
    } catch (error) {
        console.error(
            '[API V1 AUTH REGISTER]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: "Erreur interne lors de l'inscription.",
            },
            { status: 500 }
        );
    }
}
