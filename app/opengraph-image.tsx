import { ImageResponse } from 'next/og';

// Picked up automatically for og:image / twitter:image on every page that doesn't
// define its own (none currently do) — before this, sharing a Hadirin link showed no
// preview image at all. 1200x630 is the standard OG image size.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0e7c66',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', fontSize: 120 }}>✅</div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, marginTop: 24 }}>Hadirin</div>
        <div style={{ display: 'flex', fontSize: 32, marginTop: 16, opacity: 0.9 }}>
          Absensi GPS + Selfie untuk UMKM
        </div>
      </div>
    ),
    { ...size },
  );
}
