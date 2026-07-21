
'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { getEventsForOrganizer } from '@/lib/actions/event.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import type { Event, TicketType } from '@/lib/actions/types';
import type { User } from '@/lib/types';

function ManageEventsClient({ events }: { events: Event[] }) {
    const { t } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">{t('manageEventsTitle')}</h1>
                    <p className="text-muted-foreground">{t('manageEventsDescription')}</p>
                </div>
                <Button asChild>
                    <Link href="/events/create">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {t('manageEventsCreateNew')}
                    </Link>
                </Button>
            </div>

            {events.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {events.map(event => {
                         const totalSold = event.ticketTypes.reduce((sum: number, type: TicketType) => sum + type.sold, 0);
                         const totalRevenue = event.ticketTypes.reduce((sum: number, type: TicketType) => sum + (type.sold * type.price), 0);
                        return (
                            <Card key={event.id}>
                                <CardHeader>
                                    <CardTitle>{event.name}</CardTitle>
                                    <CardDescription>{new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <p><strong>{t('manageEventsSold')}:</strong> {totalSold}</p>
                                    <p><strong>{t('manageEventsGeneratedRevenue')}:</strong> {event.currency} {totalRevenue.toFixed(2)}</p>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild className="w-full">
                                        <Link href={`/events/manage/${event.id}`}>
                                            <Eye className="mr-2 h-4 w-4" /> {t('manageEventsManageAndScan')}
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-20 border-2 border-dashed rounded-lg">
                    <h3 className="mt-4 text-lg font-semibold">{t('manageEventsNoEvents')}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t('manageEventsNoEventsHint')}</p>
                </div>
            )}
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
             <div className="flex justify-between items-center">
                <div>
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-5 w-80 mt-2" />
                </div>
                <Skeleton className="h-10 w-40" />
            </div>
            <div className="text-center py-20 border-2 border-dashed rounded-lg">
                 <Skeleton className="h-6 w-1/2 mx-auto" />
                 <Skeleton className="h-4 w-1/3 mx-auto mt-2" />
            </div>
        </div>
    )
}

export default function ManageEventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            const user = await getAuthenticatedUser();
            if (!user) {
                router.push('/login');
                return;
            }
            const fetchedEvents = await getEventsForOrganizer(user.id);
            setEvents(fetchedEvents);
            setIsLoading(false);
        };

        fetchData();
    }, [router]);

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <Suspense fallback={<LoadingSkeleton />}>
                    {isLoading ? <LoadingSkeleton /> : <ManageEventsClient events={events} />}
                </Suspense>
            </main>
        </DashboardLayout>
    );
}
