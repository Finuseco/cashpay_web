import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/actions/auth.actions';
import { cookies } from 'next/headers';

/**
 * API : Vérification de l'OTP (Mobile).
 * Retourne le token JWT et établit la session CashPay.
 */
export async function POST(request: Request) {
    try {
        const { userId, otp } = await request.json();

        if (!userId || !otp) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Paramètres manquants."
                },
                { status: 400 }
            );
        }

        const result = await verifyOtp(
            parseInt(userId, 10),
            otp
        );

        if (!result.success) {
            return NextResponse.json(
                result,
                { status: 401 }
            );
        }

        if (!result.token) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Token de session non généré."
                },
                { status: 500 }
            );
        }

        const cookieStore = await cookies();

        cookieStore.set(
            'cashpay-token',
            result.token,
            {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                sameSite: 'strict',
                path: '/',
                maxAge: 60 * 60 * 24 * 30
            }
        );

        return NextResponse.json({
            success: true,
            token: result.token,
            user: result.user
        });

    } catch (e) {
        console.error("OTP verification API:", e);

        return NextResponse.json(
            {
                success: false,
                error: "Erreur interne"
            },
            { status: 500 }
        );
    }
}

