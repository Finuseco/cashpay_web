import { NextResponse } from 'next/server';
import {
    checkExistingUser,
    sendRegistrationOtp,
    verifyRegistrationOtp,
    registerUser,
} from '@/lib/actions/auth.actions';

type RegisterAction =
    | 'start'
    | 'verify_phone'
    | 'verify_email'
    | 'complete';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const action = body?.action as RegisterAction | undefined;

        if (!action) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Action requise.'
                },
                { status: 400 }
            );
        }

        // ============================================================
        // START
        // ============================================================
        if (action === 'start') {
            const {
                phone,
                email,
                countryCode,
                account_type,
            } = body;

            if (!phone || !countryCode || !account_type) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Téléphone, pays et type de compte sont requis.'
                    },
                    { status: 400 }
                );
            }

            if (!['national', 'diaspora', 'business'].includes(account_type)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Type de compte invalide.'
                    },
                    { status: 400 }
                );
            }

            const normalizedPhone = String(phone)
                .replace(/\D/g, '');

            if (!normalizedPhone) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Numéro de téléphone invalide.'
                    },
                    { status: 400 }
                );
            }

            const fullPhone = `${String(countryCode).replace(/\D/g, '')}${normalizedPhone}`;

            const phoneExists = await checkExistingUser(fullPhone);

            if (phoneExists.exists) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Ce numéro de téléphone est déjà utilisé.'
                    },
                    { status: 409 }
                );
            }

            let emailVerifiedRequired = false;

            if (email !== undefined && email !== null && String(email).trim() !== '') {
                const normalizedEmail = String(email).trim().toLowerCase();

                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

                if (!emailPattern.test(normalizedEmail)) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: 'Adresse e-mail invalide.'
                        },
                        { status: 400 }
                    );
                }

                const emailExists = await checkExistingUser(normalizedEmail);

                if (emailExists.exists) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: 'Cette adresse e-mail est déjà utilisée.'
                        },
                        { status: 409 }
                    );
                }

                emailVerifiedRequired = true;

                const emailOtp = await sendRegistrationOtp(
                    normalizedEmail,
                    'email'
                );

                if (!emailOtp.success) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: emailOtp.error || "Impossible d'envoyer l'OTP e-mail."
                        },
                        { status: 502 }
                    );
                }
            }

            const phoneOtp = await sendRegistrationOtp(
                fullPhone,
                'sms'
            );

            if (!phoneOtp.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error: phoneOtp.error || "Impossible d'envoyer l'OTP téléphone."
                    },
                    { status: 502 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'start',
                phone: fullPhone,
                email: emailVerifiedRequired
                    ? String(email).trim().toLowerCase()
                    : null,
                emailVerificationRequired: emailVerifiedRequired,
                phoneVerificationRequired: true,
                message: emailVerifiedRequired
                    ? 'OTP envoyé par SMS et par e-mail.'
                    : 'OTP envoyé par SMS.'
            });
        }

        // ============================================================
        // VERIFY PHONE
        // ============================================================
        if (action === 'verify_phone') {
            const { phone, otp } = body;

            if (!phone || !otp) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Téléphone et OTP sont requis.'
                    },
                    { status: 400 }
                );
            }

            const result = await verifyRegistrationOtp(
                String(phone),
                String(otp)
            );

            if (!result.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error: result.error
                    },
                    { status: 401 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'verify_phone',
                phoneVerified: true
            });
        }

        // ============================================================
        // VERIFY EMAIL
        // ============================================================
        if (action === 'verify_email') {
            const { email, otp } = body;

            if (!email || !otp) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'E-mail et OTP sont requis.'
                    },
                    { status: 400 }
                );
            }

            const normalizedEmail = String(email).trim().toLowerCase();

            const result = await verifyRegistrationOtp(
                normalizedEmail,
                String(otp)
            );

            if (!result.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error: result.error
                    },
                    { status: 401 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'verify_email',
                emailVerified: true
            });
        }

        // ============================================================
        // COMPLETE
        // ============================================================
        if (action === 'complete') {
            const {
                phone,
                email,
                ...registrationData
            } = body;

            if (!phone) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Téléphone requis.'
                    },
                    { status: 400 }
                );
            }

            const finalPhone = String(phone);

            const phoneExists = await checkExistingUser(finalPhone);

            if (phoneExists.exists) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Ce numéro de téléphone est déjà utilisé.'
                    },
                    { status: 409 }
                );
            }

            if (email !== undefined && email !== null && String(email).trim() !== '') {
                const normalizedEmail = String(email).trim().toLowerCase();

                const emailExists = await checkExistingUser(normalizedEmail);

                if (emailExists.exists) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: 'Cette adresse e-mail est déjà utilisée.'
                        },
                        { status: 409 }
                    );
                }

                registrationData.email = normalizedEmail;
            } else {
                registrationData.email = null;
            }

            registrationData.phone = finalPhone;

            const result = await registerUser(registrationData);

            return NextResponse.json(
                result,
                { status: result.success ? 201 : 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Action inconnue.'
            },
            { status: 400 }
        );

    } catch (error) {
        console.error('[API V1 AUTH REGISTER]', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Erreur interne lors de l’inscription.'
            },
            { status: 500 }
        );
    }
}
