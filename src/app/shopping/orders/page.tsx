
import { Suspense } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getOrdersForUser } from '@/lib/actions/shopping.actions';
import { OrdersClient } from '@/components/shopping/orders-client';
import { Skeleton } from '@/components/ui/skeleton';
import { redirect } from 'next/navigation';

function OrderListLoading() {
    return (
        <div className="p-2 space-y-3">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="p-3 space-y-2 bg-white rounded-lg">
                    <div className="flex justify-between">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-4 w-1/4" />
                    </div>
                     <div className="flex gap-3">
                         <Skeleton className="h-24 w-24 rounded-md" />
                         <div className="flex-1 space-y-2">
                             <Skeleton className="h-4 w-full" />
                             <Skeleton className="h-4 w-3/4" />
                             <Skeleton className="h-6 w-1/2" />
                         </div>
                     </div>
                </div>
            ))}
        </div>
    )
}

async function OrdersPageContent() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login?returnTo=/shopping/orders');
    }
    const orders = await getOrdersForUser(user.id);
    return <OrdersClient initialOrders={orders} />;
}


export default function OrdersPage() {
    return (
        <div className="bg-gray-100 min-h-screen">
             <Suspense fallback={<OrderListLoading />}>
                <OrdersPageContent />
            </Suspense>
        </div>
    )
}
