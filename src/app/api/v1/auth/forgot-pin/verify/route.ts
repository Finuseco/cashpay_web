import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  let connection;

  try {
    const body = await request.json();

    const userId = Number(body?.userId);
    const otp = body?.otp;

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId invalide.'
        },
        { status: 400 }
      );
    }

    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le code OTP doit contenir 6 chiffres.'
        },
        { status: 400 }
      );
    }

    connection = await db.getConnection();

    const { rows } = await connection.query(
      `SELECT id
       FROM otps
       WHERE user_id = $1::integer
         AND code = $2::text
         AND used = false
         AND expires_at > NOW()
       LIMIT 1`,
      [userId, otp]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le code de vérification est invalide ou a expiré.'
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Code OTP vérifié avec succès.'
    });
  } catch (error) {
    console.error('[API Forgot PIN Verify]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur interne lors de la vérification du code.'
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
