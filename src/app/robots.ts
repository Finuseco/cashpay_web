import type { MetadataRoute } from 'next';

const BASE_URL = 'https://app.cashpay-all.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/events',
        '/events/',
      ],
      disallow: [
        '/events/create',
        '/events/manage',
        '/events/my-tickets',
        '/api/',
        '/admin/',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
