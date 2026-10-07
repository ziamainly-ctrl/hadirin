import { ImageResponse } from 'next/og';
import { mascotDataUri } from '@/lib/brand/mascot';

// Picked up automatically for og:image / twitter:image on every page that doesn't
// define its own openGraph.images — before this, sharing a Hadirin link showed no
// preview image at all. 1200x630 is the standard OG image size. Colors are the dark
// neutral tokens from app/globals.css written out as hex, since next/og can't read CSS
// variables.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Hadirin — absensi GPS + selfie untuk UMKM';

const CHIPS = ['GPS geofence', 'Selfie wajib', 'Mulai gratis'];

export default function OpengraphImage() {
  const mark = mascotDataUri({ framing: 'full', rounded: true, idPrefix: 'ho' });
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 80px',
          background: 'radial-gradient(circle at 24% 50%, #1d3340 0%, #0a0a0a 58%)',
          color: '#fafafa',
        }}
      >
        <img src={mark} width={360} height={360} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 64 }}>
          <div style={{ display: 'flex', fontSize: 26, color: '#a3a3a3', letterSpacing: 5 }}>ABSENSI UNTUK UMKM</div>
          <div style={{ display: 'flex', fontSize: 128, fontWeight: 700, letterSpacing: -4, marginTop: 4 }}>
            Hadirin
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 36, color: '#d4d4d4', marginTop: 8 }}>
            <div style={{ display: 'flex' }}>Absensi GPS + selfie,</div>
            <div style={{ display: 'flex' }}>siap dalam 5 menit.</div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 36 }}>
            {CHIPS.map((chip) => (
              <div
                key={chip}
                style={{
                  display: 'flex',
                  padding: '9px 18px',
                  borderRadius: 999,
                  background: '#262626',
                  border: '1px solid #3f3f46',
                  fontSize: 24,
                  color: '#fafafa',
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
