
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
    }
  }

  const title = `${product.name} - JoJo Shopping`;
  const description = product.description?.substring(0, 160) || `Achetez ${product.name} sur JoJo Shopping.`;
  const imageUrl = product.image || 'https://placehold.co/1200x630.png';

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
      type: 'article',
      siteName: 'JoJo Shopping',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [imageUrl],
    },
  }
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
