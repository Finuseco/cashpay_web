
import { Suspense } from 'react';
import { getProductById } from '@/lib/actions/shopping.actions';
import { ProductDetailClient } from '@/components/shopping/product-detail-client';
import { notFound } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserCart } from '@/lib/actions/shopping.actions';
import type { CartItem } from '@/lib/types';
import type { Metadata } from 'next';

type Props = {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductById(params.id);

  if (!product) {
    return {
      title: 'Produit non trouvé',
      description: "Le produit demandé n'a pas pu être trouvé.",
    };
  }

  const productUrl = `https://app.cashpay-all.com/shopping/${product.id}`;
  const title = `${product.name} - JoJo Shopping`;

  const price = Number(product.sellingPrice);
  const currency = product.currency || 'USD';

  const priceText = Number.isFinite(price)
    ? `Prix : ${price.toFixed(2)} ${currency}`
    : '';

  const description = [
    product.description?.substring(0, 160),
    priceText,
  ]
    .filter(Boolean)
    .join(' — ') || `Découvrez ${product.name} sur JoJo Shopping.`;

  const imageUrl =
    product.image ||
    'https://app.cashpay-all.com/images/jojo/produits/default.jpg';

  return {
    metadataBase: new URL('https://app.cashpay-all.com'),

    title,
    description,

    alternates: {
      canonical: productUrl,
    },

    openGraph: {
      title,
      description,
      url: productUrl,
      siteName: 'JoJo Shopping',
      type: 'website',
      locale: 'fr_FR',
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: 1200,
          height: 1200,
          type: 'image/jpeg',
          alt: product.name,
        },
      ],
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },

    other: {
      'product:price:amount': Number.isFinite(price)
        ? price.toFixed(2)
        : '',
      'product:price:currency': currency,
    },
  };
}

function ProductDetailLoading() {
    return (
        <main className="flex-1 pb-24">
            <Skeleton className="w-full aspect-square" />
            <div className="p-4 space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-6 w-3/4" />
                </div>
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-12 flex-1" />
                </div>
            </div>
             <footer className="fixed bottom-16 left-0 right-0 z-10 bg-background border-t p-2 flex items-center gap-2">
                <Skeleton className="h-12 w-16" />
                <Skeleton className="h-12 w-16" />
                <Skeleton className="h-12 w-16" />
                <Skeleton className="h-12 flex-1" />
                <Skeleton className="h-12 flex-1" />
            </footer>
        </main>
    )
}

async function ProductDetailContent({ id }: { id: string }) {
    const product = await getProductById(id);
    if (!product) {
        notFound();
    }
    
    const user = await getAuthenticatedUser();
    let cart: CartItem[] = [];
    if (user) {
        cart = await getUserCart(user.id);
    }
    
    return <ProductDetailClient product={product} user={user} initialCart={cart} />;
}


export default async function ProductDetailPage({ params }: { params: { id: string } }) {
    return (
        <Suspense fallback={<ProductDetailLoading />}>
            <ProductDetailContent id={params.id} />
        </Suspense>
    );
}
