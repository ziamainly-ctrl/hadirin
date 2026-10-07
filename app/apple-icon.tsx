import { ImageResponse } from 'next/og';

// apple-icon only supports .jpg/.jpeg/.png as a static file (no .svg — iOS doesn't
// accept vector touch icons), so this is generated via next/og instead of a static
// asset like app/icon.svg. iOS rounds the corners itself, so this is a plain square
// with an opaque background — a transparent PNG here can show artifacts on the home
// screen. 180x180 is Apple's own recommended apple-touch-icon size.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f8fa',
          fontSize: 140,
        }}
      >
        ✅
      </div>
    ),
    { ...size },
  );
}
