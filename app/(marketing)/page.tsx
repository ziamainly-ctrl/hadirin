import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Camera, BellRing, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Absensi GPS + Selfie untuk UMKM',
  description:
    'Absensi karyawan dengan GPS dan selfie, dashboard langsung, persetujuan satu klik. Siap dalam 5 menit, mulai gratis.',
  openGraph: {
    title: 'Hadirin — Absensi GPS + Selfie untuk UMKM',
    description: 'Absensi GPS + selfie untuk UMKM, siap dalam 5 menit, mulai gratis.',
    type: 'website',
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

      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
        <h1 className="text-3xl font-bold tracking-tight text-text sm:text-5xl">
          Absensi GPS + Selfie
          <br />
          untuk UMKM
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Siap dalam 5 menit, mulai gratis. Karyawan absen dari HP, kamu pantau dari mana saja.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register">
            <Button size="lg">Mulai Gratis</Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="secondary">
              Lihat Harga
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} shadow>
              <feature.icon className="h-8 w-8 text-primary" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-text">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold text-text">Cara kerja</h2>
        <ol className="mt-8 space-y-6">
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

      <section className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold text-text">Pertanyaan umum</h2>
        <dl className="mt-8 space-y-6">
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
      </section>
    </>
  );
}
