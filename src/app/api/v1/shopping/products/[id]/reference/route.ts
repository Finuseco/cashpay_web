import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getAgentProducts } from '@/lib/actions/agent.actions';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
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

    if (!id.trim()) {
      return NextResponse.json(
        { success: false, error: 'Référence du produit requise.' },
        { status: 400 }
      );
    }

    const products = await getAgentProducts(Number(user.id));
    const product = products.find(item => item.id === id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produit introuvable ou non autorisé.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      reference: product.id,
      productId: product.id,
      name: product.name,
      barcode: product.barcode,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer la référence du produit.',
      },
      { status: 500 }
    );
  }
}
