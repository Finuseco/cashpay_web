import type { MetadataRoute } from 'next';
import { getEvents } from '@/lib/actions/event.actions';

const BASE_URL = 'https://app.cashpay-all.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEvents();

  return [
    {
      url: `${BASE_URL}/events`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...events.map((event) => ({
      url: `${BASE_URL}/events/${event.id}`,
      lastModified: new Date(event.date),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
  ];
}
