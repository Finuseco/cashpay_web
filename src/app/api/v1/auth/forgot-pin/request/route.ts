import { NextResponse } from 'next/server';
import { sendOtp } from '@/lib/actions/auth.actions';
import { db } from '@/lib/db';

type OtpChannel = 'sms' | 'whatsapp';

export async function POST(request: Request) {
  let connection;

  try {
    const body = await request.json();

    const phone = body?.phone;
    const channel = body?.channel as OtpChannel;

    if (typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le numéro de téléphone est requis.'
        },
        { status: 400 }
      );
    }

    if (channel !== 'sms' && channel !== 'whatsapp') {
      return NextResponse.json(
        {
          success: false,
          error: 'Canal invalide. Utilisez sms ou whatsapp.'
        },
        { status: 400 }
      );
    }

    const normalizedPhone = phone.trim();

    connection = await db.getConnection();

    const { rows } = await connection.query(
      `SELECT id, phone
       FROM users
       WHERE phone LIKE $1::text
       LIMIT 1`,
      [`%${normalizedPhone.slice(-9)}`]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Aucun compte associé à ce numéro.'
        },
        { status: 404 }
      );
    }

    const user = rows[0];

    if (!user.phone) {
      return NextResponse.json(
        {
          success: false,
          error: 'Aucun numéro de téléphone disponible pour ce compte.'
        },
        { status: 400 }
      );
    }

    const result = await sendOtp(user.id, channel);

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
      userId: user.id
    });
  } catch (error) {
    console.error('[API Forgot PIN Request]', error);

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
