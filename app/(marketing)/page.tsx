import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import ButtonLink from '@/components/ui/ButtonLink';
import CheckInPreview from './check-in-preview';

export const metadata: Metadata = {
  title: 'Absensi GPS + Selfie untuk UMKM',
  description:
    'Absensi karyawan dengan GPS dan selfie, dashboard langsung, persetujuan satu klik. Siap dalam 5 menit, mulai gratis.',
  openGraph: {
    title: 'Hadirin — Absensi GPS + Selfie untuk UMKM',
    description: 'Absensi GPS + selfie untuk UMKM, siap dalam 5 menit, mulai gratis.',
    type: 'website',
    // Every other page has no openGraph field of its own, so Next auto-merges
    // app/opengraph-image.tsx's output into it for free. This page defines openGraph
    // explicitly (for its own title/description/type), which opts it out of that
    // auto-merge — confirmed by comparing this page's head output against /about's
    // before this line existed. images: ['/opengraph-image'] (the route's own path,
    // no query hash needed — the hash Next adds elsewhere is just a cache key, the
    // bare route serves the same image) restores it explicitly.
    images: ['/opengraph-image'],
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Hadirin',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Absensi karyawan dengan GPS dan selfie untuk UMKM Indonesia.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
};

export default function LandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* The home page is a single screen: the hero only. Features, pricing, the story, check-in
          and help each have their own page in the header menu. The column is the header's own
          (max-w-6xl, px-4), so the headline lines up under the logo and the phone under Sign up.
          Type and spacing are clamp()s of the viewport's width AND height, capped at what the
          1152px column holds: still inside the window at 1024x600 (the page never scrolls on desktop). */}
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-8 lg:py-[clamp(1rem,3vh,3rem)]">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-[clamp(2rem,5vw,6rem)]">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted lg:text-[length:clamp(0.75rem,min(0.9vw,1.7vh),0.875rem)]">
              <Sparkles className="h-[1.1667em] w-[1.1667em] text-text" aria-hidden="true" />
              Siap dipakai dalam 5 menit
            </span>
            <h1 className="mt-4 text-balance text-3xl font-bold leading-[1.1] tracking-tight text-text sm:text-5xl lg:mt-[clamp(0.75rem,2.4vh,1.5rem)] lg:text-[length:clamp(2.5rem,min(4.4vw,7.6vh),3.5rem)]">
              Absensi GPS + Selfie{' '}
              <br />
              untuk UMKM
            </h1>
            <p className="mx-auto mt-4 max-w-[30em] text-pretty text-base text-muted sm:text-lg lg:mx-0 lg:mt-[clamp(0.75rem,2.4vh,1.5rem)] lg:text-[length:clamp(1rem,min(1.3vw,2.4vh),1.25rem)]">
              Karyawan absen lewat HP dengan GPS dan selfie. Anda memantau kehadiran tim dari mana saja, tanpa mesin
              absen.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:mt-[clamp(1.25rem,4vh,2.5rem)] lg:justify-start">
              <ButtonLink href="/register" size="lg" className="w-full sm:w-auto">
                Mulai Gratis
              </ButtonLink>
              <ButtonLink href="/fitur" size="lg" variant="outline" className="w-full sm:w-auto">
                Lihat Fitur
              </ButtonLink>
            </div>
          </div>
          <CheckInPreview />
        </div>
      </section>
    </>
  );
}
