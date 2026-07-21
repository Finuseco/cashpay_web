

'use client';

import { StarlinkDashboardClient } from '../starlink-dashboard-client';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function StarlinkDashboardLoading() {
    return (
        <div className="p-4 md:p-8">
            <div className="text-center mb-8">
                <Skeleton className="h-9 w-72 mx-auto" />
                <Skeleton className="h-5 w-96 mx-auto mt-2" />
            </div>
            <Skeleton className="h-10 w-full max-w-md mx-auto" />
            <div className="mt-6">
                 <Skeleton className="h-64 w-full max-w-2xl mx-auto" />
            </div>
        </div>
    )
}

export default function StarlinkDashboardPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={<StarlinkDashboardLoading />}>
                <StarlinkDashboardClient />
            </Suspense>
        </DashboardLayout>
    )
}
