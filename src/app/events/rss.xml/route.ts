import { getEvents } from '@/lib/actions/event.actions';

const BASE_URL = 'https://app.cashpay-all.com';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const events = await getEvents();

  const items = events.map((event) => {
    const url = `${BASE_URL}/events/${event.id}`;
    const imageUrl = event.imageUrl
      ? (event.imageUrl.startsWith('http://localhost:8002')
          ? event.imageUrl.replace('http://localhost:8002', BASE_URL)
          : (event.imageUrl.startsWith('http://') || event.imageUrl.startsWith('https://')
              ? event.imageUrl
              : `${BASE_URL}${event.imageUrl.startsWith('/') ? '' : '/'}${event.imageUrl}`))
      : '';

    const image = imageUrl
      ? `<media:content url="${escapeXml(imageUrl)}" medium="image" />`
      : '';

    const description = [
      event.description || '',
      event.location ? `Lieu : ${event.location}` : '',
      event.organizerName ? `Organisateur : ${event.organizerName}` : '',
    ]
      .filter(Boolean)
      .join(' — ');

    return `
      <item>
        <title>${escapeXml(event.name)}</title>
        <link>${escapeXml(url)}</link>
        <guid isPermaLink="true">${escapeXml(url)}</guid>
        <description>${escapeXml(description)}</description>
        <pubDate>${new Date(event.date).toUTCString()}</pubDate>
        ${image}
      </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>CashPay Events</title>
    <link>${BASE_URL}/events</link>
    <description>Événements publics disponibles sur CashPay All</description>
    <language>fr</language>
    <ttl>30</ttl>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
