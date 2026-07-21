import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicProducts } from '@/lib/actions/shopping.actions';
import { JojoMarketClient } from '@/components/shopping/jojo-market-client';

function ShoppingLoading() {
    return (
        <div className="p-4 space-y-6">
            <Skeleton className="h-40 w-full rounded-lg" />
            <div className="grid grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="aspect-square w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-6 w-1/2" />
                    </div>
                ))}
            </div>
        </div>
    )
}

async function ShoppingContent() {
    const products = await getPublicProducts();
    return <JojoMarketClient products={products} />;
}


export default function ShoppingHomePage() {
  return (
      <Suspense fallback={<ShoppingLoading />}>
        <ShoppingContent />
      </Suspense>
  );
}
