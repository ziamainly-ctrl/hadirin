import type { MetadataRoute } from 'next';

// The public menu: five pages, home is the hero only. /check-in is left out on purpose (it
// requires login and is noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return [
    { url: `${appUrl}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${appUrl}/pricing`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${appUrl}/fitur`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${appUrl}/about`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${appUrl}/bantuan`, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
