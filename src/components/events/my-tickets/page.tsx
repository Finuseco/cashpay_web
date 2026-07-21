
import { Suspense } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getTicketsForUser } from '@/lib/actions/event.actions';
import { redirect } from 'next/navigation';
import { MyTicketsClient } from '@/components/events/my-tickets-client';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Skeleton } from '@/components/ui/skeleton';

async function MyTicketsContent() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login');
    }
    const ticketsByEvent = await getTicketsForUser(user.id);
    return <MyTicketsClient ticketsByEvent={ticketsByEvent} />;
}

function LoadingSkeleton() {
    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <Skeleton className="h-9 w-1/3" />
                <Skeleton className="h-5 w-2/3" />
                <div className="space-y-4">
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-32 w-full rounded-lg" />
                </div>
            </div>
        </main>
    );
}

export default function MyTicketsPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={<LoadingSkeleton />}>
                <MyTicketsContent />
            </Suspense>
        </DashboardLayout>
    );
}
