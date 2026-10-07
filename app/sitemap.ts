import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return [
    { url: `${appUrl}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${appUrl}/pricing`, changeFrequency: 'weekly', priority: 0.9 },
  ];
}
