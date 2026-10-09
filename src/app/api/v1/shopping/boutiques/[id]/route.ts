import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
  getAgentBoutiques,
  addOrUpdateBoutique,
  deleteBoutique,
} from '@/lib/actions/agent.actions';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: Context
) {
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

    const { id } = await context.params;
    const boutiques = await getAgentBoutiques(Number(user.id));
    const boutique = boutiques.find(item => item.id === id);

    if (!boutique) {
      return NextResponse.json(
        { success: false, error: 'Boutique introuvable.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      boutique,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer la boutique.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: Context
) {
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

    const { id } = await context.params;
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
        id,
        name,
        address,
        whatsapp_public_number: whatsappPublicNumber,
      },
      Number(user.id)
    );

    return NextResponse.json(
      result,
      { status: result.success ? 200 : 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de modifier la boutique.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: Context
) {
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

    const { id } = await context.params;
    const result = await deleteBoutique(id, Number(user.id));

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de supprimer la boutique.',
      },
      { status: 500 }
    );
  }
}
