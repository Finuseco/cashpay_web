

import { Suspense } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getFollowedStores, getPublicProducts } from '@/lib/actions/shopping.actions';
import { redirect } from 'next/navigation';
import { ProductCard } from '@/components/shopping/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function FollowedStoresLoading() {
    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4"><Skeleton className="h-7 w-48" /></h1>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="aspect-square w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-6 w-1/2" />
                    </div>
                ))}
            </div>
        </div>
    );
}


async function FollowedStoresContent() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login?returnTo=/shopping/followed-stores');
    }

    const followedStores = await getFollowedStores(user.id);
    const followedStoreIds = new Set(followedStores.map(store => store.id.toString()));
    
    // We can fetch all products and filter, or create a new dedicated action.
    // For simplicity, let's filter the public products.
    const allProducts = await getPublicProducts();
    const productsFromFollowedStores = allProducts.filter(product => 
        followedStoreIds.has(product.seller.id)
    );

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4">Articles des boutiques que vous suivez</h1>
            {productsFromFollowedStores.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                    {productsFromFollowedStores.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 text-muted-foreground">
                    <p>Aucun article à afficher.</p>
                    <p className="text-sm">Les produits des boutiques que vous suivez apparaîtront ici.</p>
                    <Button asChild variant="link" className="mt-2">
                        <Link href="/shopping/home">Découvrir des produits</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function FollowedStoresPage() {
    return (
        <Suspense fallback={<FollowedStoresLoading />}>
            <FollowedStoresContent />
        </Suspense>
    );
}
