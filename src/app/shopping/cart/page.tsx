
import { Suspense } from 'react';
import { CartClient } from '@/components/shopping/cart-client';
import { Skeleton } from '@/components/ui/skeleton';

function CartLoading() {
    return (
        <div className="p-2 space-y-3">
            <div className="bg-background rounded-lg p-3 space-y-4">
                <div className="flex items-center gap-3 pb-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-24" />
                </div>
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <Skeleton className="h-20 w-20 rounded-md" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-6 w-1/3" />
                        </div>
                    </div>
                ))}
            </div>
             <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3">
                <Skeleton className="h-11 w-full" />
            </div>
        </div>
    )
}

export default function CartPage() {
    return (
        <Suspense fallback={<CartLoading />}>
            <CartClient />
        </Suspense>
    );
}
