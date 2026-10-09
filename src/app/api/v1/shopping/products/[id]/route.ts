import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
  getAgentBoutiques,
  getAgentProducts,
  addOrUpdateProduct,
  deleteProduct,
} from '@/lib/actions/agent.actions';

function isFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function GET(
  request: NextRequest,
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
      product,
      reference: product.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer le produit.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
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
    const products = await getAgentProducts(Number(user.id));
    const existingProduct = products.find(item => item.id === id);

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Produit introuvable ou non autorisé.' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const name = String(body?.name ?? existingProduct.name ?? '').trim();
    const description = String(
      body?.description ?? existingProduct.description ?? ''
    ).trim();
    const categoryId = String(
      body?.categoryId ?? existingProduct.categoryId ?? ''
    ).trim();
    const boutiqueId = String(
      body?.boutiqueId ?? existingProduct.boutiqueId ?? ''
    ).trim();
    const barcode = String(
      body?.barcode ?? existingProduct.barcode ?? ''
    ).trim();

    const purchasePrice = Number(
      body?.purchasePrice ?? existingProduct.purchasePrice
    );
    const sellingPrice = Number(
      body?.sellingPrice ?? existingProduct.sellingPrice
    );
    const weight = Number(
      body?.weight ?? existingProduct.weight ?? 0
    );
    const stock = Number(
      body?.stock ?? existingProduct.stock ?? 0
    );

    const images = Array.isArray(body?.images)
      ? body.images
      : existingProduct.images || [];

    const variations = Array.isArray(body?.variations)
      ? body.variations
      : existingProduct.variations || [];

    const shippingRates = Array.isArray(body?.shippingRates)
      ? body.shippingRates
      : existingProduct.shippingRates ?? null;

    const promotionalPackages = Array.isArray(body?.promotionalPackages)
      ? body.promotionalPackages
      : existingProduct.promotionalPackages ?? null;

    if (name.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Le nom du produit doit contenir au moins 3 caractères.' },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'La catégorie est requise.' },
        { status: 400 }
      );
    }

    if (!boutiqueId) {
      return NextResponse.json(
        { success: false, error: 'La boutique est requise.' },
        { status: 400 }
      );
    }

    if (!isFiniteNumber(purchasePrice) || purchasePrice < 0) {
      return NextResponse.json(
        { success: false, error: "Le prix d'achat est invalide." },
        { status: 400 }
      );
    }

    if (!isFiniteNumber(sellingPrice) || sellingPrice < 0.01) {
      return NextResponse.json(
        { success: false, error: 'Le prix de vente est invalide.' },
        { status: 400 }
      );
    }

    if (!barcode) {
      return NextResponse.json(
        { success: false, error: 'Le code-barres / SKU est requis.' },
        { status: 400 }
      );
    }

    if (images.length < 1 || images.length > 5) {
      return NextResponse.json(
        { success: false, error: 'Le produit doit avoir entre 1 et 5 images.' },
        { status: 400 }
      );
    }

    if (!isFiniteNumber(weight) || weight < 0) {
      return NextResponse.json(
        { success: false, error: 'Le poids est invalide.' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(stock) || stock < 0) {
      return NextResponse.json(
        { success: false, error: 'Le stock doit être un nombre entier positif.' },
        { status: 400 }
      );
    }

    if (variations.length < 1) {
      return NextResponse.json(
        { success: false, error: 'Ajoutez au moins une variation.' },
        { status: 400 }
      );
    }

    for (const variation of variations) {
      const color = String(variation?.color || '').trim();
      const variationStock = Number(variation?.stock);

      if (!color) {
        return NextResponse.json(
          { success: false, error: 'La couleur est requise pour chaque variation.' },
          { status: 400 }
        );
      }

      if (!Number.isInteger(variationStock) || variationStock < 0) {
        return NextResponse.json(
          { success: false, error: 'Le stock de chaque variation doit être un entier positif.' },
          { status: 400 }
        );
      }
    }

    if (shippingRates) {
      for (const item of shippingRates) {
        const country = String(item?.country || '').trim().toUpperCase();
        const province = String(item?.province || '').trim();
        const rate = Number(item?.rate);

        if (!country || !province || !Number.isFinite(rate) || rate < 0) {
          return NextResponse.json(
            { success: false, error: 'Un tarif de livraison est invalide.' },
            { status: 400 }
          );
        }
      }
    }

    if (promotionalPackages) {
      for (const item of promotionalPackages) {
        const quantity = Number(item?.quantity);
        const price = Number(item?.price);

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          !Number.isFinite(price) ||
          price < 0
        ) {
          return NextResponse.json(
            { success: false, error: 'Une offre promotionnelle est invalide.' },
            { status: 400 }
          );
        }
      }
    }

    const boutiques = await getAgentBoutiques(Number(user.id));
    const boutique = boutiques.find(item => item.id === boutiqueId);

    if (!boutique) {
      return NextResponse.json(
        { success: false, error: 'Boutique introuvable ou non autorisée.' },
        { status: 403 }
      );
    }

    const currentDetails =
      existingProduct.details &&
      typeof existingProduct.details === 'object'
        ? existingProduct.details
        : {};

    const details =
      body?.details && typeof body.details === 'object'
        ? body.details
        : currentDetails;

    const productData: any = {
      id,
      name,
      description,
      categoryId,
      boutiqueId,
      purchasePrice,
      sellingPrice,
      barcode,
      images,
      isPublic:
        body?.isPublic !== undefined
          ? Boolean(body.isPublic)
          : Boolean(existingProduct.isPublic),
      weight,
      stock,
      variations: variations.map((item: any) => ({
        color: String(item.color).trim(),
        stock: Number(item.stock),
      })),
      shippingRates,
      promotionalPackages,
      details,
      isbn10:
        body?.isbn10 !== undefined
          ? String(body.isbn10).trim() || undefined
          : existingProduct.isbn10,
      isbn13:
        body?.isbn13 !== undefined
          ? String(body.isbn13).trim() || undefined
          : existingProduct.isbn13,
    };

    if (categoryId === 'cat-livre') {
      productData.details = {
        ...details,
        pdfUrl:
          body?.pdfUrl !== undefined
            ? body.pdfUrl || undefined
            : details.pdfUrl,
        sourceUrl:
          body?.sourceUrl !== undefined
            ? body.sourceUrl || undefined
            : details.sourceUrl,
        audioUrl:
          body?.audioUrl !== undefined
            ? body.audioUrl || undefined
            : details.audioUrl,
      };
    }

    const result = await addOrUpdateProduct(
      productData,
      Number(user.id)
    );

    if (!result.success) {
      return NextResponse.json(
        result,
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      product: result.product,
      reference: result.product?.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de modifier le produit.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
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

    const result = await deleteProduct(
      id,
      Number(user.id)
    );

    if (!result.success) {
      return NextResponse.json(
        result,
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      reference: id,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de supprimer le produit.',
      },
      { status: 500 }
    );
  }
}
