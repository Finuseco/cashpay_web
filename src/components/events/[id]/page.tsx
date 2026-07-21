'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { Calendar, Clock, MapPin, Users, CheckCircle, Info, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PurchaseTicketButton } from '@/components/events/purchase-ticket-button';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { User } from '@/lib/types';
import type { Event, TicketType } from '@/lib/actions/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { getEventById } from '@/lib/actions/event.actions';
import { notFound } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import type { Metadata } from 'next';

// This is now a Client Component that receives server-fetched data
function EventDetailsClient({ event }: { event: Event }) {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [isLoadingUser, setIsLoadingUser] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            setIsLoadingUser(false);
        };
        fetchUser();
    }, []);

    const totalTickets = event.ticketTypes.reduce((sum: number, type: any) => sum + type.quantity, 0);

    if (isLoadingUser) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="relative h-64 md:h-80 w-full rounded-lg overflow-hidden bg-muted">
                <Image src={event.imageUrl || 'https://placehold.co/1200x400.png'} alt={event.name} fill className="object-cover" data-ai-hint="event poster" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <h1 className="absolute bottom-6 left-6 text-4xl font-extrabold text-white">{event.name}</h1>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardContent className="p-6 grid grid-cols-2 gap-6 text-sm">
                            <div className="flex items-start gap-3"><Calendar className="h-5 w-5 text-primary mt-1" /><p><span className="font-semibold">{t('date')}:</span><br/>{format(new Date(event.date), "EEEE d MMMM yyyy", { locale: fr })}</p></div>
                            <div className="flex items-start gap-3"><Clock className="h-5 w-5 text-primary mt-1" /><p><span className="font-semibold">{t('time')}:</span><br/>{event.time}</p></div>
                            <div className="flex items-start gap-3"><MapPin className="h-5 w-5 text-primary mt-1" /><p><span className="font-semibold">{t('location')}:</span><br/>{event.location}</p></div>
                            <div className="flex items-start gap-3"><UserIcon className="h-5 w-5 text-primary mt-1" /><p><span className="font-semibold">{t('organizer')}:</span><br/>{event.organizerName}</p></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('description')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-line">{event.description}</p>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="space-y-6">
                    <Card>
                         <CardHeader>
                            <CardTitle>{t('eventDetailsBuyTickets')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             {!user && (
                                <Alert>
                                    <Info className="h-4 w-4"/>
                                    <AlertTitle>{t('eventDetailsLoginToBuy')}</AlertTitle>
                                    <AlertDescription>
                                        {t('eventDetailsLoginDescription')}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {event.ticketTypes.map((ticketType: TicketType) => (
                                <div key={ticketType.id} className="p-3 rounded-md bg-muted/50">
                                  <div className="flex justify-between items-center">
                                      <div>
                                          <p className="font-semibold">{ticketType.type}</p>
                                          <p className="font-bold text-lg">{ticketType.price.toLocaleString('fr-FR')} {event.currency}</p>
                                      </div>
                                      <span className="text-xs text-muted-foreground">{ticketType.quantity - ticketType.sold > 0 ? `${ticketType.quantity - ticketType.sold} ${t('eventDetailsTicketsAvailable')}` : t('eventDetailsSoldOut')}</span>
                                  </div>
                                  <div className="mt-2">
                                      <PurchaseTicketButton event={event} ticketType={ticketType} user={user} />
                                  </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardContent className="p-4 text-center space-y-2">
                             <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                <Users className="h-5 w-5"/>
                                <p><span className="font-bold text-foreground">{totalTickets}</span> {t('eventDetailsTicketsAvailable')}</p>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-green-600">
                                <CheckCircle className="h-5 w-5"/>
                                <p className="font-semibold">{t('eventDetailsSecurePayment')}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}


// --- Loading Skeleton ---
function LoadingSkeleton() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-80 w-full rounded-lg" />
            <div className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="md:col-span-2 space-y-6">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        </div>
    )
}

// --- Server-side Metadata Generation ---
type Props = {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventById(params.id);
  
  if (!event) {
    return {
      title: 'Événement non trouvé',
      description: "L'événement demandé n'a pas pu être trouvé.",
    }
  }

  const title = `${event.name} - CashPay Events`;
  const description = event.description.substring(0, 160);
  const imageUrl = event.imageUrl || 'https://placehold.co/1200x630.png';

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: event.name,
        },
      ],
      type: 'website',
      siteName: 'CashPay Events',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [imageUrl],
    },
  }
}

// --- Server Component Page ---
export default async function EventDetailPage({ params }: { params: { id: string } }) {
    const event = await getEventById(params.id);
    
    if (!event) {
        notFound();
    }

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <Suspense fallback={<LoadingSkeleton />}>
                    <EventDetailsClient event={event} />
                </Suspense>
            </main>
        </DashboardLayout>
    );
}