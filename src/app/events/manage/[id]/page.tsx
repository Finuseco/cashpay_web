
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getEventById } from '@/lib/actions/event.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { EventManageClient } from '@/components/events/manage/[id]/event-manage-client';

function LoadingSkeleton() {
    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                    <Skeleton className="h-8 w-48 mb-1" />
                    <Skeleton className="h-4 w-64" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
            </div>
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
        </div>
    );
}

async function EventManageData({ eventId }: { eventId: string }) {
    const user = await getAuthenticatedUser();
    if (!user) return null;

    const event = await getEventById(eventId);
    if (!event) {
        notFound();
    }

    return <EventManageClient initialEvent={event} userId={user.id} />;
}

export default async function EventManagePage({ params }: { params: { id: string } }) {
    return (
        <DashboardLayout>
            <main className="flex-1">
                <Suspense fallback={<LoadingSkeleton />}>
                    <EventManageData eventId={params.id} />
                </Suspense>
            </main>
        </DashboardLayout>
    );
}
