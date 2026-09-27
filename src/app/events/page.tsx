'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getEvents } from '@/lib/actions/event.actions';
import {
  PlusCircle,
  Ticket,
  Cog,
  Calendar,
  MapPin,
  Loader2,
  Search,
  ArrowLeft,
  LayoutGrid,
  List,
  Rows3,
  SlidersHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/lib/actions/types';
import { useTranslation } from 'react-i18next';

type ViewMode = 'grid' | 'list' | 'featured';

function getImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return 'https://placehold.co/1200x700.png';

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  return `https://app.cashpay-all.com${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

function EventCard({
  event,
  mode,
}: {
  event: Event;
  mode: ViewMode;
}) {
  const { t } = useTranslation();

  const startingPrice =
    event.ticketTypes.length > 0
      ? Math.min(...event.ticketTypes.map((ticket: any) => ticket.price))
      : 0;

  const imageUrl = getImageUrl(event.imageUrl);

  if (mode === 'list') {
    return (
      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <Link
            href={`/events/${event.id}`}
            className="relative h-52 w-full shrink-0 sm:h-auto sm:w-56"
          >
            <Image
              src={imageUrl}
              alt={event.name}
              fill
              className="object-cover"
            />
          </Link>

          <CardContent className="flex flex-1 flex-col justify-between p-4">
            <div>
              {event.eventType && (
                <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {event.eventType}
                </span>
              )}

              <Link href={`/events/${event.id}`}>
                <h3 className="mt-2 text-xl font-bold hover:text-primary">
                  {event.name}
                </h3>
              </Link>

              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(event.date), 'd MMMM yyyy', {
                    locale: fr,
                  })}
                </p>

                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </p>
              </div>

              {event.description && (
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {event.description}
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('eventsFrom')}
                </p>
                <p className="font-bold">
                  {startingPrice.toLocaleString('fr-FR')} {event.currency}
                </p>
              </div>

              <Button asChild size="sm">
                <Link href={`/events/${event.id}`}>Voir</Link>
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  return (
    <Card className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/events/${event.id}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <Image
            src={imageUrl}
            alt={event.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />

          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
            {event.eventType ? (
              <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur">
                {event.eventType}
              </span>
            ) : (
              <span />
            )}
          </div>
        </div>
      </Link>

      <CardContent className="p-4 sm:p-5">
        <Link href={`/events/${event.id}`}>
          <h3 className="line-clamp-2 text-lg font-bold leading-tight transition-colors group-hover:text-primary">
            {event.name}
          </h3>
        </Link>

        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            {format(new Date(event.date), 'd MMMM yyyy', {
              locale: fr,
            })}
          </p>

          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t('eventsFrom')}
            </p>
            <p className="font-bold">
              {startingPrice.toLocaleString('fr-FR')} {event.currency}
            </p>
          </div>

          <Button asChild size="sm">
            <Link href={`/events/${event.id}`}>Voir</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FeaturedEvent({ event }: { event: Event }) {
  const startingPrice =
    event.ticketTypes.length > 0
      ? Math.min(...event.ticketTypes.map((ticket: any) => ticket.price))
      : 0;

  return (
    <Card className="overflow-hidden">
      <div className="grid md:grid-cols-2">
        <Link
          href={`/events/${event.id}`}
          className="relative min-h-[280px] bg-muted md:min-h-[420px]"
        >
          <Image
            src={getImageUrl(event.imageUrl)}
            alt={event.name}
            fill
            className="object-cover"
          />
        </Link>

        <CardContent className="flex flex-col justify-center p-6 md:p-8">
          {event.eventType && (
            <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {event.eventType}
            </span>
          )}

          <Link href={`/events/${event.id}`}>
            <h2 className="mt-3 text-2xl font-bold md:text-3xl">
              {event.name}
            </h2>
          </Link>

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(event.date), 'd MMMM yyyy', {
                locale: fr,
              })}
            </p>

            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {event.location}
            </p>
          </div>

          {event.description && (
            <p className="mt-4 line-clamp-4 text-sm text-muted-foreground">
              {event.description}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">À partir de</p>
              <p className="text-xl font-bold">
                {startingPrice.toLocaleString('fr-FR')} {event.currency}
              </p>
            </div>

            <Button asChild>
              <Link href={`/events/${event.id}`}>Voir l'événement</Link>
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export default function EventsPage() {
  const { t } = useTranslation();

  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('date-desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    let active = true;

    const fetchEvents = async () => {
      try {
        const fetchedEvents = await getEvents();

        if (active) {
          setEvents(fetchedEvents);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchEvents();

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const values = events
      .map((event) => event.eventType?.trim())
      .filter(Boolean) as string[];

    return ['all', ...Array.from(new Set(values))];
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = events.filter((event) => {
      const matchesCategory =
        category === 'all' ||
        event.eventType?.toLowerCase() === category.toLowerCase();

      const searchableText = [
        event.name,
        event.description,
        event.location,
        event.organizerName,
        event.eventType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesCategory && (!query || searchableText.includes(query));
    });

    return [...result].sort((a, b) => {
      if (sort === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }

      if (sort === 'name') {
        return a.name.localeCompare(b.name, 'fr');
      }

      if (sort === 'price-asc') {
        const aPrice =
          a.ticketTypes.length > 0
            ? Math.min(...a.ticketTypes.map((ticket: any) => ticket.price))
            : 0;
        const bPrice =
          b.ticketTypes.length > 0
            ? Math.min(...b.ticketTypes.map((ticket: any) => ticket.price))
            : 0;

        return aPrice - bPrice;
      }

      if (sort === 'price-desc') {
        const aPrice =
          a.ticketTypes.length > 0
            ? Math.min(...a.ticketTypes.map((ticket: any) => ticket.price))
            : 0;
        const bPrice =
          b.ticketTypes.length > 0
            ? Math.min(...b.ticketTypes.map((ticket: any) => ticket.price))
            : 0;

        return bPrice - aPrice;
      }

      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [events, search, category, sort]);

  return (
    <main className="min-h-full bg-background">


      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {t('pageTitleEvents')}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t('eventsDiscover')}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/events/my-tickets">
                <Ticket className="mr-2 h-4 w-4" />
                Mes billets
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link href="/events/manage">
                <Cog className="mr-2 h-4 w-4" />
                Gérer
              </Link>
            </Button>

            <Button asChild size="sm">
              <Link href="/events/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Créer
              </Link>
            </Button>
          </div>
        </section>

        <section className="rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher un événement, un lieu, un organisateur..."
                  className="h-11 rounded-xl pl-10"
                />
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  aria-label="Trier les événements"
                >
                  <option value="date-desc">Plus récents</option>
                  <option value="date-asc">Date la plus proche</option>
                  <option value="name">Nom A-Z</option>
                  <option value="price-asc">Prix croissant</option>
                  <option value="price-desc">Prix décroissant</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t pt-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categories.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      size="sm"
                      className="shrink-0 rounded-full"
                      variant={category === item ? 'default' : 'outline'}
                      onClick={() => setCategory(item)}
                    >
                      {item === 'all' ? 'Tous' : item}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-lg border p-1">
                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  aria-label="Affichage en grille"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  aria-label="Affichage en liste"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === 'featured' ? 'default' : 'ghost'}
                  aria-label="Affichage grande carte"
                  onClick={() => setViewMode('featured')}
                >
                  <Rows3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed py-20 text-center">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">
              Aucun événement trouvé
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Modifiez votre recherche ou vos filtres.
            </p>
          </div>
        ) : viewMode === 'featured' ? (
          <div className="space-y-6">
            <FeaturedEvent event={filteredEvents[0]} />

            {filteredEvents.length > 1 && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.slice(1).map((event) => (
                  <EventCard key={event.id} event={event} mode="grid" />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'
                : 'space-y-4'
            }
          >
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                mode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
