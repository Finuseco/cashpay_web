
'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { TerminalDetailClient } from './terminal-detail-client';

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
            </div>

            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
        </div>
    )
}

export default function TerminalDetailPage() {
    const params = useParams();
    const terminalId = params.id as string;
    
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <TerminalDetailClient terminalId={terminalId} />
        </Suspense>
    );
}
