
'use client';

import { Suspense } from 'react';
import { AgentOrdersClient } from '@/components/agent/agent-orders-client';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-72" />
        <div className="flex items-center gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
        </div>
        <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/4" />
                    </div>
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-16 w-16 rounded-md" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}

export default function AgentOrdersPage() {
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <AgentOrdersClient />
        </Suspense>
    );
}
