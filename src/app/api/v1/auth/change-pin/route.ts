import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, updatePin } from '@/lib/actions/user.actions';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentification requise.'
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const oldPin = body?.oldPin;
    const newPin = body?.newPin;
    const confirmPin = body?.confirmPin;

    if (
      typeof oldPin !== 'string' ||
      typeof newPin !== 'string' ||
      typeof confirmPin !== 'string'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Les champs oldPin, newPin et confirmPin sont requis.'
        },
        { status: 400 }
      );
    }

    if (
      !/^\d{4}$/.test(oldPin) ||
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

    if (oldPin === newPin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le nouveau PIN doit être différent de l’ancien.'
        },
        { status: 400 }
      );
    }

    const result = await updatePin({ userId: user.id, oldPin, newPin });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'PIN modifié avec succès.'
    });
  } catch (error) {
    console.error('[API Change PIN]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Une erreur est survenue lors du changement du PIN.'
      },
      { status: 500 }
    );
  }
}
