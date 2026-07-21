'use client';

import { Suspense } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getMlmMemberDashboard } from '@/lib/actions/mlm.actions';
import { MyNetworkClient } from '@/components/mlm/my-network-client';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
        </div>
    );
}

function MyNetworkPageContent() {
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const user = await getAuthenticatedUser();
            if (user) {
                const data = await getMlmMemberDashboard(user.id);
                setDashboardData(data);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <LoadingSkeleton />;
    }

    if (!dashboardData) {
        return <div className="text-center p-8 text-muted-foreground">Vous ne faites pas encore partie d'un réseau.</div>;
    }

    return <MyNetworkClient data={dashboardData} />;
}

export default function MyNetworkPage() {
    return (
        <DashboardLayout pageTitleKey="Mon Réseau MLM">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-6xl mx-auto">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <MyNetworkPageContent />
                    </Suspense>
                </div>
            </main>
        </DashboardLayout>
    );
}
