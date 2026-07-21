
import { Suspense } from 'react';
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { EvisaHistoryClient } from '@/app/e-visa/history/evisa-history-client';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getEvisaApplicationsForUser } from '@/lib/actions/evisa.actions';
import { redirect } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

function HistoryLoading() {
    return (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-4 w-1/3 mt-1" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}


async function EvisaHistoryData() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login?returnTo=/e-visa/history');
    }
    const applications = await getEvisaApplicationsForUser(user.id);
    return <EvisaHistoryClient initialApplications={applications} />;
}


export default function EvisaHistoryPage() {
    return (
        <DashboardLayout pageTitleKey="Mes Demandes E-Visa">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Suspense fallback={<HistoryLoading />}>
                        <EvisaHistoryData />
                    </Suspense>
                </div>
            </main>
        </DashboardLayout>
    );
}
