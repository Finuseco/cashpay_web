import { Suspense } from 'react';
import {
    getPublicProducts,
    getSellerInfo,
    getPublicBoutiqueContact,
} from '@/lib/actions/shopping.actions';
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
    );
}

async function SellerProductsContent({
    sellerId,
    boutiqueId,
}: {
    sellerId: string;
    boutiqueId?: string;
}) {
    const sellerInfo = await getSellerInfo(sellerId);

    if (!sellerInfo) {
        notFound();
    }

    const allProducts = await getPublicProducts();

    let sellerProducts = allProducts.filter(
        product => product.seller.id === sellerId
    );

    if (boutiqueId) {
        sellerProducts = sellerProducts.filter(
            product => product.boutiqueId === boutiqueId
        );
    }

    if (boutiqueId && sellerProducts.length === 0) {
        notFound();
    }

    const selectedBoutiqueId =
        boutiqueId || sellerProducts[0]?.boutiqueId || '';

    const boutique = selectedBoutiqueId
        ? await getPublicBoutiqueContact(selectedBoutiqueId, sellerId)
        : null;

    return (
        <SellerProductsClient
            products={sellerProducts}
            seller={sellerInfo}
            boutique={boutique}
        />
    );
}

export default async function SellerPage({
    params,
    searchParams,
}: {
    params: { sellerId: string };
    searchParams?: { boutiqueId?: string };
}) {
    return (
        <Suspense fallback={<SellerProductsLoading />}>
            <SellerProductsContent
                sellerId={params.sellerId}
                boutiqueId={searchParams?.boutiqueId}
            />
        </Suspense>
    );
}
