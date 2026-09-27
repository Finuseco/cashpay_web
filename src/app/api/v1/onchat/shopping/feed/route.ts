import { NextResponse } from 'next/server';
import {
  getPublicProducts,
  getStoreFollowerInfo,
  toggleFollowStore,
} from '@/lib/actions/shopping.actions';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedLimit = Number(
      searchParams.get('limit') || DEFAULT_LIMIT
    );

    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    /*
     * FEED PUBLIC JOJO SHOPPING
     *
     * Aucun userId.
     * Aucun token.
     * Aucune session.
     *
     * L'application récupère directement les activités
     * et les affiche.
     */
    const products = await getPublicProducts();

    const selectedProducts = products.slice(0, limit);

    /*
     * Récupération des vendeurs présents dans le feed.
     */
    const sellerIds = [
      ...new Set(
        selectedProducts
          .map((product) => Number(product.seller?.id))
          .filter(
            (id) => Number.isInteger(id) && id > 0
          )
      ),
    ];

    /*
     * Récupération publique du nombre d'abonnés
     * de chaque boutique.
     *
     * userId = undefined :
     * aucune identification d'utilisateur.
     */
    const followerInfoEntries = await Promise.all(
      sellerIds.map(async (sellerId) => {
        const info = await getStoreFollowerInfo(
          undefined,
          sellerId
        );

        return [
          String(sellerId),
          info,
        ] as const;
      })
    );

    const followerInfoMap = new Map(
      followerInfoEntries
    );

    const feed = selectedProducts.map((product) => {
      const sellerId = product.seller?.id
        ? String(product.seller.id)
        : null;

      const followerInfo = sellerId
        ? followerInfoMap.get(sellerId)
        : undefined;

      return {
        productId: String(product.id),

        productName: product.name,

        sellerId,

        boutiqueId: product.boutiqueId
          ? String(product.boutiqueId)
          : null,

        shopName:
          product.boutiqueName ||
          product.seller?.name ||
          'Jojo Shopping',

        followerCount:
          followerInfo?.followerCount ?? 0,

        imageUrl:
          product.image ||
          product.images?.[0] ||
          'https://placehold.co/600x600.png',

        price: Number(
          product.sellingPrice || 0
        ),

        currency:
          product.currency || 'USD',

        productUrl:
          `/shopping/${product.id}`,
      };
    });

    return NextResponse.json({
      success: true,

      products: feed,

      count: feed.length,

      limit,
    });
  } catch (error) {
    console.error(
      '[OnChat Shopping Feed] Error:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          'Impossible de récupérer les produits Jojo Shopping.',

        products: [],

        count: 0,
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * ============================================================
 * ABONNEMENT / DÉSABONNEMENT À UNE BOUTIQUE
 * ============================================================
 *
 * Ici seulement, l'application fournit :
 *
 * userId   = utilisateur qui s'abonne
 * sellerId = boutique / vendeur concerné
 *
 * Aucun token.
 * Aucun getAuthenticatedUser().
 * Aucune session.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userId = Number(body?.userId);

    const sellerId = Number(body?.sellerId);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId invalide.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(sellerId) ||
      sellerId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'sellerId invalide.',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Le userId fourni par l'application est utilisé
     * pour créer ou supprimer l'abonnement dans
     * boutique_followers.
     */
    const result = await toggleFollowStore(
      userId,
      sellerId
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,

          error:
            result.error ||
            "Erreur lors de l'abonnement à la boutique.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Après l'opération, on récupère le nouveau
     * nombre public d'abonnés de la boutique.
     *
     * On utilise userId ici uniquement pour savoir
     * si CET utilisateur suit actuellement la boutique.
     */
    const followerInfo =
      await getStoreFollowerInfo(
        userId,
        sellerId
      );

    return NextResponse.json({
      success: true,

      userId,

      sellerId,

      isFollowing:
        followerInfo.isFollowing,

      followerCount:
        followerInfo.followerCount,
    });
  } catch (error) {
    console.error(
      '[OnChat Shopping Feed] Follow Error:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Impossible de modifier l'abonnement à la boutique.",
      },
      {
        status: 500,
      }
    );
  }
}
