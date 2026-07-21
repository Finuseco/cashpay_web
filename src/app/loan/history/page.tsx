
import { Suspense } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLoanHistory } from '@/lib/actions/loan.actions';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { LoanHistoryClient } from './loan-history-client';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

async function LoanHistoryData() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login?returnTo=/loan/history');
    }
    const history = await getLoanHistory(user.id);
    return <LoanHistoryClient initialHistory={history} />;
}


export default function LoanHistoryPage() {
    return (
        <DashboardLayout pageTitleKey="Historique des Prêts">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <LoanHistoryData />
                    </Suspense>
                </div>
            </main>
        </DashboardLayout>
    );
}
