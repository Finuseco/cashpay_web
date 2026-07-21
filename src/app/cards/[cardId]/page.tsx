
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getCardById } from '@/lib/actions/card.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { CardDetailClient } from './card-detail-client';
import { getTransactionControls } from '@/lib/actions/transaction-controls.actions';

function LoadingSkeleton() {
    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-9 w-9" />
                <div>
                    <Skeleton className="h-7 w-48 mb-1" />
                    <Skeleton className="h-4 w-64" />
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="aspect-[1.586] w-full max-w-sm rounded-2xl" />
                <div className="space-y-4">
                    <Skeleton className="h-48 rounded-lg" />
                    <Skeleton className="h-32 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

async function CardDetailContent({ cardId, user }: { cardId: string, user: any }) {
    const [card, controls] = await Promise.all([
        getCardById(cardId, user.id),
        getTransactionControls(cardId)
    ]);
    
    if (!card) {
        notFound();
    }
    
    return <CardDetailClient card={card} initialControls={controls} />;
}

export default async function CardDetailPage({ params }: { params: { cardId: string } }) {
    const user = await getAuthenticatedUser();
    if (!user) {
        // This will be handled by the layout's auth check
        return null;
    }

    return (
        <DashboardLayout pageTitleKey="cardDetails">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <CardDetailContent cardId={params.cardId} user={user} />
                    </Suspense>
                </div>
            </main>
        </DashboardLayout>
    );
}
