
import { Suspense } from 'react';
import { getPublicProducts, getSellerInfo } from '@/lib/actions/shopping.actions';
import { SellerProductsClient } from '@/components/shopping/seller-products-client';
import { Skeleton } from '@/components/ui/skeleton';
import { notFound } from 'next/navigation';

function SellerProductsLoading() {
    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
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
    )
}

async function SellerProductsContent({ sellerId }: { sellerId: string }) {
    const sellerInfo = await getSellerInfo(sellerId);
    if (!sellerInfo) {
        notFound();
    }
    
    const allProducts = await getPublicProducts();
    const sellerProducts = allProducts.filter(p => p.seller.id === sellerId);
    
    return <SellerProductsClient products={sellerProducts} seller={sellerInfo} />;
}


export default async function SellerPage({ params }: { params: { sellerId: string } }) {
  return (
      <Suspense fallback={<SellerProductsLoading />}>
        <SellerProductsContent sellerId={params.sellerId} />
      </Suspense>
  );
}
