import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
  getAgentBoutiques,
  getAgentProducts,
  addOrUpdateProduct,
} from '@/lib/actions/agent.actions';
import { countryToCode } from '@/lib/countries';

function isFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

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

    const countryCode = countryToCode(user.country);

    if (!countryCode) {
      return NextResponse.json(
        { success: false, error: 'Le pays du profil agent est introuvable.' },
        { status: 400 }
      );
    }

    const [products, boutiques] = await Promise.all([
      getAgentProducts(Number(user.id)),
      getAgentBoutiques(Number(user.id)),
    ]);

    return NextResponse.json({
      success: true,
      country: user.country,
      countryCode,
      boutiques,
      products,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer les produits.',
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

    const countryCode = countryToCode(user.country);

    if (!countryCode) {
      return NextResponse.json(
        { success: false, error: 'Le pays du profil agent est introuvable.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const name = String(body?.name || '').trim();
    const description = String(body?.description || '').trim();
    const categoryId = String(body?.categoryId || '').trim();
    const boutiqueId = String(body?.boutiqueId || '').trim();
    const barcode = String(body?.barcode || '').trim();
    const purchasePrice = Number(body?.purchasePrice);
    const sellingPrice = Number(body?.sellingPrice);
    const weight = Number(body?.weight);
    const stock = Number(body?.stock);
    const images = Array.isArray(body?.images) ? body.images : [];
    const variations = Array.isArray(body?.variations) ? body.variations : [];
    const shippingRates = Array.isArray(body?.shippingRates)
      ? body.shippingRates
      : null;
    const promotionalPackages = Array.isArray(body?.promotionalPackages)
      ? body.promotionalPackages
      : null;

    if (name.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le nom du produit doit contenir au moins 3 caractères.',
        },
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
          {
            success: false,
            error: 'La couleur est requise pour chaque variation.',
          },
          { status: 400 }
        );
      }

      if (!Number.isInteger(variationStock) || variationStock < 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Le stock de chaque variation doit être un entier positif.',
          },
          { status: 400 }
        );
      }
    }

    if (shippingRates) {
      for (const item of shippingRates) {
        const country = String(item?.country || '')
          .trim()
          .toUpperCase();
        const province = String(item?.province || '').trim();
        const rate = Number(item?.rate);

        if (!country || !province || !Number.isFinite(rate) || rate < 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'Un tarif de livraison est invalide.',
            },
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
            {
              success: false,
              error: 'Une offre promotionnelle est invalide.',
            },
            { status: 400 }
          );
        }
      }
    }

    const boutiques = await getAgentBoutiques(Number(user.id));
    const boutique = boutiques.find((item) => item.id === boutiqueId);

    if (!boutique) {
      return NextResponse.json(
        {
          success: false,
          error: 'Boutique introuvable ou non autorisée.',
        },
        { status: 403 }
      );
    }

    const details =
      body?.details && typeof body.details === 'object'
        ? body.details
        : {};

    const productData = {
      name,
      description,
      categoryId,
      boutiqueId,
      purchasePrice,
      sellingPrice,
      barcode,
      images,
      isPublic: Boolean(body?.isPublic),
      weight,
      stock,
      variations: variations.map((item: any) => ({
        color: String(item.color).trim(),
        stock: Number(item.stock),
      })),
      shippingRates,
      promotionalPackages,
      details,
      isbn10: body?.isbn10
        ? String(body.isbn10).trim()
        : undefined,
      isbn13: body?.isbn13
        ? String(body.isbn13).trim()
        : undefined,
    };

    if (categoryId === 'cat-livre') {
      productData.details = {
        ...details,
        pdfUrl: body?.pdfUrl || details.pdfUrl || undefined,
        sourceUrl: body?.sourceUrl || details.sourceUrl || undefined,
        audioUrl: body?.audioUrl || details.audioUrl || undefined,
      };
    }

    const result = await addOrUpdateProduct(
      productData,
      Number(user.id)
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        country: user.country,
        countryCode,
        product: result.product,
        reference: result.product?.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message || 'Impossible de publier le produit.',
      },
      { status: 500 }
    );
  }
}
