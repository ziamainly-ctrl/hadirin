import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hadirin',
    short_name: 'Hadirin',
    description: 'Absensi GPS + selfie untuk UMKM',
    start_url: '/m',
    display: 'standalone',
    background_color: '#f7f8fa',
    theme_color: '#0e7c66',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
