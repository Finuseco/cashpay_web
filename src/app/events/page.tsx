
'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getEvents } from '@/lib/actions/event.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { PlusCircle, Ticket, Cog, Calendar, MapPin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/lib/actions/types';
import type { User } from '@/lib/types';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

function EventCard({ event }: { event: Event }) {
    const { t } = useTranslation();
    const startingPrice = event.ticketTypes.length > 0
        ? Math.min(...event.ticketTypes.map((t: any) => t.price))
        : 0;

    return (
        <Link href={`/events/${event.id}`}>
            <Card className="overflow-hidden group h-full flex flex-col">
                <div className="relative aspect-video bg-muted">
                    <Image 
                        src={event.imageUrl || 'https://placehold.co/600x400.png'} 
                        alt={event.name} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform"
                        data-ai-hint="concert crowd"
                    />
                </div>
                <CardContent className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">{event.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><Calendar className="h-3 w-3"/> {format(new Date(event.date), "d MMMM yyyy", { locale: fr })}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3"/> {event.location}</p>
                    </div>
                    <div className="mt-2 text-right">
                        <p className="text-xs text-muted-foreground">{t('eventsFrom')}</p>
                        <p className="font-bold text-lg text-foreground">{startingPrice.toLocaleString('fr-FR')} {event.currency}</p>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

function EventsPageContent({ events }: { events: Event[] }) {
    const { t } = useTranslation();
    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex justify-between items-center mb-6 gap-2">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">{t('pageTitleEvents')}</h1>
                        <p className="text-muted-foreground">{t('eventsDiscover')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                            <Button asChild variant="outline">
                            <Link href="/events/my-tickets">
                                <Ticket className="mr-2 h-4 w-4" />
                                {t('eventsMyTicketsButton')}
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/events/manage">
                                <Cog className="mr-2 h-4 w-4" />
                                {t('eventsManageButton')}
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/events/create">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                {t('eventsCreateButton')}
                            </Link>
                        </Button>
                    </div>
                </div>
                {events.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((event: Event) => <EventCard key={event.id} event={event} />)}
                    </div>
                ) : (
                    <div className="text-center py-20 border-2 border-dashed rounded-lg">
                        <Ticket className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">{t('eventsNoEventsTitle')}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{t('eventsNoEventsDescription')}</p>
                    </div>
                )}
            </div>
        </main>
    )
}

// The main page is now an async Server Component
export default function EventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    
    useEffect(() => {
        const checkAuthAndFetch = async () => {
            const user = await getAuthenticatedUser();
            if (!user) {
                router.push('/login');
                return;
            }
            const fetchedEvents = await getEvents();
            setEvents(fetchedEvents);
            setIsLoading(false);
        }
        checkAuthAndFetch();
    }, [router]);

    return (
        <DashboardLayout>
            <Suspense fallback={<div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
                {isLoading ? <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin"/></div> : <EventsPageContent events={events} />}
            </Suspense>
        </DashboardLayout>
    );
}
