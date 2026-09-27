

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getEventById } from '@/lib/actions/event.actions';
import { EventDetailsClient } from './event-details-client';
import { Skeleton } from '@/components/ui/skeleton';


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
    };
  }

  const title = `${event.name} - CashPay Events`;
  const description = (event.description || '').substring(0, 160);
  const eventUrl = `https://app.cashpay-all.com/events/${event.id}`;
  const imageUrl = event.imageUrl
    ? (event.imageUrl.startsWith('http://') || event.imageUrl.startsWith('https://')
        ? event.imageUrl
        : `https://app.cashpay-all.com${event.imageUrl.startsWith('/') ? '' : '/'}${event.imageUrl}`)
    : 'https://placehold.co/1200x630.png';

  return {
    title,
    description,
    alternates: {
      canonical: eventUrl,
    },
    openGraph: {
      title,
      description,
      url: eventUrl,
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
      title,
      description,
      images: [imageUrl],
    },
  };
}

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

// --- Server Component Page ---
export default async function EventDetailPage({ params }:
{ params: { id: string } }) {
    const event = await getEventById(params.id);

    if (!event) {
        notFound();
    }

    const eventUrl = `https://app.cashpay-all.com/events/${event.id}`;
    const imageUrl = event.imageUrl
        ? (event.imageUrl.startsWith('http://') || event.imageUrl.startsWith('https://')
            ? event.imageUrl
            : `https://app.cashpay-all.com${event.imageUrl.startsWith('/') ? '' : '/'}${event.imageUrl}`)
        : 'https://placehold.co/1200x630.png';
    const startDate = `${event.date.substring(0, 10)}T${event.time}`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.name,
        description: event.description || '',
        url: eventUrl,
        image: [imageUrl],
        startDate,
        eventStatus: 'https://schema.org/EventScheduled',
        location: {
            '@type': 'Place',
            name: event.location || 'CashPay Events',
        },
        organizer: {
            '@type': 'Person',
            name: event.organizerName || 'CashPay Events',
        },
        offers: event.ticketTypes.map((ticket) => ({
            '@type': 'Offer',
            url: eventUrl,
            price: ticket.price,
            priceCurrency: event.currency,
            availability:
                ticket.quantity > ticket.sold
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/SoldOut',
        })),
    };

    return (
        <main className="min-h-screen flex-1 p-4 md:p-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(jsonLd),
                }}
            />

            <Suspense fallback={<LoadingSkeleton />}>
                <EventDetailsClient event={event} />
            </Suspense>
        </main>
    );
}

