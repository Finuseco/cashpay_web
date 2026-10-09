import { NextRequest, NextResponse } from 'next/server';
import { subscribeAsAgent } from '@/lib/actions/agent-application.actions';
import { getAuthenticatedUser } from '@/lib/actions/auth.actions';

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
    const plan = body?.plan;
    const pin = body?.pin;

    if (plan !== 'promo' && plan !== 'normal') {
      return NextResponse.json(
        {
          success: false,
          error: 'Plan invalide. Utilisez promo ou normal.'
        },
        { status: 400 }
      );
    }

    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le PIN doit contenir exactement 4 chiffres.'
        },
        { status: 400 }
      );
    }

    const result = await subscribeAsAgent(user.id, plan, pin);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Statut Agent activé avec succès.'
    });
  } catch (error) {
    console.error('[API Agent Activate]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Une erreur est survenue lors de l’activation du statut Agent.'
      },
      { status: 500 }
    );
  }
}
