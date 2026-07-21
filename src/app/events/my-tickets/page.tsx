
'use client';

import { Suspense, useEffect, useState } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getTicketsForUser } from '@/lib/actions/event.actions';
import { redirect } from 'next/navigation';
import { MyTicketsClient } from '@/components/events/my-tickets-client';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import type { EventTicket } from '@/lib/actions/event.actions';

function LoadingSkeleton() {
    const { t } = useTranslation();
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
    const { t } = useTranslation();
    const [ticketsByEvent, setTicketsByEvent] = useState<EventTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchData = async () => {
            const user = await getAuthenticatedUser();
            if (!user) {
                redirect('/login');
                return;
            }
            const tickets = await getTicketsForUser(user.id);
            setTicketsByEvent(tickets);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    return (
        <DashboardLayout>
            <Suspense fallback={<LoadingSkeleton />}>
                {isLoading ? <LoadingSkeleton /> : <MyTicketsClient ticketsByEvent={ticketsByEvent} />}
            </Suspense>
        </DashboardLayout>
    );
}
