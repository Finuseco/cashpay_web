

'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from '@/components/shopping/product-card';
import type { Product } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserWishlist } from '@/lib/actions/shopping.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

export default function WishlistPage() {
  const { t } = useTranslation();
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      setIsLoading(true);
      const user = await getAuthenticatedUser();
      if (user) {
        const wishlist = await getUserWishlist(user.id);
        setFavoriteProducts(wishlist);
      }
      setIsLoading(false);
    };
    fetchWishlist();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{t('wishlistTitle')}</h1>
      {isLoading ? (
         <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
            </div>
            <div className="space-y-2">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
            </div>
        </div>
      ) : favoriteProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {favoriteProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <p>{t('wishlistEmpty')}</p>
          <p className="text-sm">{t('wishlistEmptyHint')}</p>
        </div>
      )}
    </div>
  );
}
