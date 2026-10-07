import { ImageResponse } from 'next/og';
import { mascotDataUri } from '@/lib/brand/mascot';

// PWA manifest icons (app/manifest.ts), rendered from the same drawing as the favicon so
// there are no binary PNGs in git to drift. Android Chrome wants real 192 and 512 PNGs for
// install prompts and splash screens, and a maskable one whose artwork stays inside the
// central safe zone (the OS crops it to a circle/squircle of its own).
const ICONS = {
  '192': { px: 192, maskable: false },
  '512': { px: 512, maskable: false },
  'maskable-512': { px: 512, maskable: true },
} as const;

type IconName = keyof typeof ICONS;

export const dynamicParams = false;

export function generateStaticParams() {
  return (Object.keys(ICONS) as IconName[]).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const icon = ICONS[name as IconName];
  if (!icon) return new Response('Not found', { status: 404 });

  // Maskable art is full-bleed (neutral gradient square): the OS applies its own mask,
  // and the face sits well inside the central 80% safe zone. The regular icon is
  // transparent like the favicon.
  const art = mascotDataUri({ framing: 'tight', background: icon.maskable ? 'neutral' : 'none', idPrefix: `hp${icon.px}` });
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={art} width={icon.px} height={icon.px} alt="" />,
    { width: icon.px, height: icon.px },
  );
}
