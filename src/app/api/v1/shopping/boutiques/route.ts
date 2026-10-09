import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
  getAgentBoutiques,
  addOrUpdateBoutique,
} from '@/lib/actions/agent.actions';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    if (user.role !== 'agent') {
      return NextResponse.json(
        { success: false, error: 'Accès réservé aux agents.' },
        { status: 403 }
      );
    }

    const boutiques = await getAgentBoutiques(Number(user.id));

    return NextResponse.json({
      success: true,
      boutiques,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer les boutiques.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    if (user.role !== 'agent') {
      return NextResponse.json(
        { success: false, error: 'Accès réservé aux agents.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = String(body?.name || '').trim();
    const address = body?.address ? String(body.address).trim() : null;
    const whatsappPublicNumber = body?.whatsapp_public_number
      ? String(body.whatsapp_public_number).trim()
      : null;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Le nom de la boutique est requis.' },
        { status: 400 }
      );
    }

    const result = await addOrUpdateBoutique(
      {
        name,
        address,
        whatsapp_public_number: whatsappPublicNumber,
      },
      Number(user.id)
    );

    return NextResponse.json(
      result,
      { status: result.success ? 201 : 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de créer la boutique.',
      },
      { status: 500 }
    );
  }
}
