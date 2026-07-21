
'use client';

import { Suspense, useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { SellerDetailsContent } from '@/components/agent/seller-details-client';
import { getSellerById } from '@/lib/actions/agent.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import type { Seller } from '@/lib/types';

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
             <div className="flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 mt-1" />
                </div>
            </div>
            <CardSkeleton />
            <CardSkeleton />
        </div>
    )
}

const CardSkeleton = () => (
    <div className="p-4 border rounded-lg space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
    </div>
);


export default function SellerDetailsPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [sellerDetails, setSellerDetails] = useState<Seller | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const sellerId = parseInt(params.id, 10);
        if (isNaN(sellerId)) {
            // Handle invalid ID, maybe show an error or redirect
            console.error("Invalid Seller ID");
            setIsLoading(false);
            return;
        }

        const fetchDetails = async () => {
            setIsLoading(true);
            const result = await getSellerById(sellerId);
            if (!result.success || !result.seller) {
                // Not found, handle accordingly
                 console.error(result.error || "Seller not found");
            } else {
                 setSellerDetails(result.seller);
            }
            setIsLoading(false);
        };
        
        fetchDetails();
    }, [params.id]);
    
    if (isLoading) {
        return <LoadingSkeleton />;
    }
    
    if (!sellerDetails) {
        return <div className="p-4 text-destructive">Vendeur non trouvé.</div>;
    }
    
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <SellerDetailsContent seller={sellerDetails} />
        </Suspense>
    );
}
