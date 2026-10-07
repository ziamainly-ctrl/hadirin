import { ImageResponse } from 'next/og';
import { createElement } from 'react';
import { mascotDataUri } from '@/lib/brand/mascot';
import { pngsToIco } from '@/lib/brand/ico';

// Static at build time (no request APIs are read), so the rasterizing cost is paid once.
const SIZES = [48, 32, 16];

async function renderPng(size: number): Promise<Uint8Array> {
  const src = mascotDataUri({ framing: 'tight', rounded: true, idPrefix: `hi${size}` });
  const res = new ImageResponse(createElement('img', { src, width: size, height: size, alt: '' }), {
    width: size,
    height: size,
  });
  return new Uint8Array(await res.arrayBuffer());
}

export async function GET() {
  const images = await Promise.all(SIZES.map(async (size) => ({ size, png: await renderPng(size) })));
  return new Response(pngsToIco(images), {
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
