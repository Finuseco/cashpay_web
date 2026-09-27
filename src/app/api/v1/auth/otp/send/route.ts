import { NextResponse } from 'next/server';
import { sendOtp } from '@/lib/actions/auth.actions';
import { db } from '@/lib/db';

type OtpChannel = 'sms' | 'email' | 'whatsapp';

export async function POST(request: Request) {
    let connection;

    try {
        const body = await request.json();
        const { userId, channel } = body as {
            userId?: number | string;
            channel?: OtpChannel;
        };

        if (!userId || !channel) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'userId et channel sont requis.'
                },
                { status: 400 }
            );
        }

        if (!['sms', 'email', 'whatsapp'].includes(channel)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Canal OTP invalide.'
                },
                { status: 400 }
            );
        }

        const parsedUserId = Number(userId);

        if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'userId invalide.'
                },
                { status: 400 }
            );
        }

        connection = await db.getConnection();

        const { rows } = await connection.query(
            `SELECT id, email, phone
             FROM users
             WHERE id = $1::integer`,
            [parsedUserId]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Utilisateur non trouvé.'
                },
                { status: 404 }
            );
        }

        const user = rows[0];

        if (channel === 'email' && !user.email) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Aucune adresse email disponible pour cet utilisateur.'
                },
                { status: 400 }
            );
        }

        if (
            (channel === 'sms' || channel === 'whatsapp') &&
            !user.phone
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Aucun numéro de téléphone disponible pour cet utilisateur.'
                },
                { status: 400 }
            );
        }

        const result = await sendOtp(parsedUserId, channel);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error || "Impossible d'envoyer le code."
                },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success: true,
            message: result.message,
            channel,
            destination: result.destination,
            userId: parsedUserId
        });
    } catch (error) {
        console.error('[API V1 AUTH OTP SEND]', error);

        return NextResponse.json(
            {
                success: false,
                error: "Erreur interne lors de l'envoi du code."
            },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
}
