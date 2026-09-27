import { NextResponse } from 'next/server';
import { getEvents } from '@/lib/actions/event.actions';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedLimit = Number(
      searchParams.get('limit') || DEFAULT_LIMIT
    );

    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const events = await getEvents();

    const feed = events
      .slice(0, limit)
      .map((event) => {
        const ticketTypes = Array.isArray(event.ticketTypes)
          ? event.ticketTypes.map((ticket) => ({
              id: ticket.id,
              type: ticket.type,
              price: Number(ticket.price || 0),
              currency: event.currency || 'USD',
              quantity: Number(ticket.quantity || 0),
              sold: Number(ticket.sold || 0),
            }))
          : [];

        const prices = ticketTypes
          .map((ticket) => Number(ticket.price))
          .filter((price) => Number.isFinite(price));

        const minimumTicketPrice =
          prices.length > 0 ? Math.min(...prices) : null;

        return {
          eventId: String(event.id),

          title: event.name,
          description: event.description || '',

          imageUrl:
            event.imageUrl ||
            'https://placehold.co/800x500.png',

          date: event.date,
          time: event.time || null,

          location: event.location || null,

          organizerName: event.organizerName || null,

          currency: event.currency || 'USD',

          minimumTicketPrice,

          ticketTypes,

          eventUrl: `/events/${event.id}`,
        };
      });

    return NextResponse.json({
      success: true,
      events: feed,
      count: feed.length,
      limit,
    });
  } catch (error) {
    console.error('[OnChat Events Feed] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de récupérer les événements.',
        events: [],
        count: 0,
      },
      {
        status: 500,
      }
    );
  }
}
