
'use client';

import { Suspense } from 'react';
import { DeveloperPageClient } from '@/components/developer/developer-page-client';
import { Skeleton } from '@/components/ui/skeleton';

function DeveloperPageLoading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-9 w-1/3" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
}

export default function AgentDeveloperPage() {

    return (
        <Suspense fallback={<DeveloperPageLoading />}>
            <DeveloperPageClient />
        </Suspense>
    );
}

