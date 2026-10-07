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
    // A scalable SVG needs only one entry (sizes: 'any' per the Web App Manifest spec)
    // instead of separately-rasterized 192/512 files — public/icon.svg is the same mark
    // app/icon.svg serves as the browser-tab favicon, just duplicated into public/ since
    // this manifest needs a stable literal URL, not Next's generated icon route.
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
