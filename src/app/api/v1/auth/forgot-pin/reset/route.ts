import { NextResponse } from 'next/server';
import { resetPinWithOtp } from '@/lib/actions/auth.actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userId = Number(body?.userId);
    const otp = body?.otp;
    const newPin = body?.newPin;
    const confirmPin = body?.confirmPin;

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

    if (
      typeof newPin !== 'string' ||
      typeof confirmPin !== 'string' ||
      !/^\d{4}$/.test(newPin) ||
      !/^\d{4}$/.test(confirmPin)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le PIN doit contenir exactement 4 chiffres.'
        },
        { status: 400 }
      );
    }

    if (newPin !== confirmPin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Les nouveaux codes PIN ne correspondent pas.'
        },
        { status: 400 }
      );
    }

    const result = await resetPinWithOtp(
      userId,
      otp,
      newPin
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Impossible de réinitialiser le PIN.'
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Votre PIN a été réinitialisé avec succès.'
    });
  } catch (error) {
    console.error('[API Forgot PIN Reset]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur interne lors de la réinitialisation du PIN.'
      },
      { status: 500 }
    );
  }
}
