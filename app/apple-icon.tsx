import { ImageResponse } from 'next/og';
import { mascotDataUri } from '@/lib/brand/mascot';

// apple-icon only supports .jpg/.jpeg/.png as a static file (no .svg — iOS doesn't
// accept vector touch icons), so this is generated via next/og from the same drawing as
// the favicon. iOS rounds the corners itself, so this is a plain full-bleed square (no
// rounded tile) with an opaque background — transparent corners show as black on the home
// screen. 180x180 is Apple's own recommended apple-touch-icon size.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  const src = mascotDataUri({ framing: 'tight', rounded: false, idPrefix: 'ha' });
  return new ImageResponse(
    (
      // next/og renders plain elements through Satori, so a raw <img> is correct here.
      <img src={src} width={180} height={180} alt="" />
    ),
    { ...size },
  );
}
