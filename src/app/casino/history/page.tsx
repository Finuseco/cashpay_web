
import { Suspense } from 'react';
import { HistoryClient } from '@/components/casino/history-client';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCasinoTransactions } from '@/lib/actions/game.actions';
import { Skeleton } from '@/components/ui/skeleton';

async function HistoryContent() {
    const user = await getAuthenticatedUser();
    if (!user) return <p>Veuillez vous connecter pour voir votre historique.</p>;

    const transactions = await getCasinoTransactions(user.id);
    
    return <HistoryClient transactions={transactions} />;
}

function LoadingSkeleton() {
    return (
        <div className="p-4 space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                     <div key={i} className="flex justify-between items-center p-3 bg-zinc-800 rounded-md">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-1.5">
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </div>
                        <div className="text-right space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function CasinoHistoryPage() {
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <HistoryContent />
        </Suspense>
    );
}
