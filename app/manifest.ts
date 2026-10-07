import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hadirin',
    short_name: 'Hadirin',
    description: 'Absensi GPS + selfie untuk UMKM',
    start_url: '/m',
    display: 'standalone',
    // Light-theme page background and primary from app/globals.css (oklch(0.985 0 0) and
    // oklch(0.205 0 0)) as hex: a manifest can't hold one value per color scheme.
    background_color: '#fafafa',
    theme_color: '#171717',
    // The SVG (public/icon.svg, same drawing as the tab favicon) for browsers that take
    // vectors, plus real PNGs from app/icons/[name]/route.tsx: Android Chrome needs 192 and
    // 512 for the install prompt and splash screen, and the maskable one lets the OS crop
    // the icon to its own shape without clipping the face.
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
