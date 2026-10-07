import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Camera, BellRing, CheckCircle2, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
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

const FEATURES = [
  {
    icon: MapPin,
    title: 'Geofence otomatis',
    description: 'Karyawan hanya bisa absen di radius kantor/cabang yang kamu tentukan — tanpa perangkat tambahan.',
  },
  {
    icon: Camera,
    title: 'Selfie wajib',
    description: 'Setiap absen disertai foto selfie, jadi tidak ada lagi titip absen.',
  },
  {
    icon: BellRing,
    title: 'Dashboard & notifikasi langsung',
    description: 'Pantau siapa yang sudah/belum hadir hari ini, dan dapat notifikasi saat ada yang terlambat.',
  },
];

const STEPS = [
  { title: 'Daftar', description: 'Buat akun perusahaan dalam 1 menit, gratis tanpa kartu kredit.' },
  { title: 'Atur cabang & shift', description: 'Tambah lokasi kantor (gunakan lokasi GPS kamu) dan jam kerja.' },
  { title: 'Undang karyawan', description: 'Tambahkan karyawan, mereka langsung bisa absen dari HP masing-masing.' },
];

const FAQ = [
  {
    q: 'Apakah karyawan perlu install aplikasi?',
    a: 'Tidak. Absensi dibuka lewat browser HP (bisa dipasang sebagai PWA), tidak perlu download dari app store.',
  },
  {
    q: 'Bagaimana jika sinyal GPS lemah?',
    a: 'Sistem akan memberi tahu jika akurasi GPS terlalu lemah dan meminta karyawan pindah ke tempat terbuka.',
  },
  {
    q: 'Bisa dipakai untuk banyak cabang?',
    a: 'Ya, setiap cabang punya titik lokasi dan radius sendiri. Jumlah cabang mengikuti paket yang dipilih.',
  },
  {
    q: 'Apa yang terjadi kalau masa coba gratis habis?',
    a: 'Jika belum membayar, akun otomatis turun ke paket Gratis jika masih sesuai batasnya, atau perlu upgrade jika sudah melebihi.',
  },
];

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

      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-surface px-3 py-1 text-xs font-medium text-muted dark:border-white/10">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Siap dipakai dalam 5 menit
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-text sm:text-5xl">
              Absensi GPS + Selfie
              <br />
              untuk UMKM
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted lg:mx-0">
              Mulai gratis. Karyawan absen dari HP dengan GPS dan selfie, kamu pantau siapa yang hadir dari mana saja,
              hari ini juga.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Mulai Gratis
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Lihat Harga
                </Button>
              </Link>
            </div>
          </div>
          <CheckInPreview />
        </div>
      </section>

      <section id="fitur" className="scroll-mt-20 border-y border-black/5 bg-surface py-16 dark:border-white/5">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-text">Semua yang dibutuhkan tim lapangan</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-text">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-text">Cara kerja</h2>
        <ol className="mt-10 space-y-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-text">{step.title}</h3>
                <p className="text-sm text-muted">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-black/5 bg-surface py-16 dark:border-white/5">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-2xl font-bold text-text">Pertanyaan umum</h2>
          <dl className="mt-10 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="flex items-start gap-2 font-semibold text-text">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  {item.q}
                </dt>
                <dd className="mt-1 pl-7 text-sm text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
