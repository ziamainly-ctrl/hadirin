import type { Metadata } from 'next';
import { MapPin, Camera, Rocket } from 'lucide-react';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Tentang Kami',
  description: 'Hadirin dibangun untuk UMKM Indonesia yang butuh absensi GPS + selfie yang jujur dan cepat dipasang.',
};

const VALUES = [
  {
    icon: MapPin,
    title: 'Jujur soal lokasi',
    description: 'Setiap absen divalidasi radius GPS di server, bukan sekadar dipercaya dari HP karyawan.',
  },
  {
    icon: Camera,
    title: 'Anti titip absen',
    description: 'Selfie wajib di setiap check-in/out membuat kehadiran sulit diwakilkan orang lain.',
  },
  {
    icon: Rocket,
    title: 'Cepat dipakai',
    description: 'Tanpa perangkat fingerprint, tanpa instalasi IT. Daftar, atur cabang dan shift, langsung jalan.',
  },
];

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-text">Tentang Hadirin</h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-muted">
        Hadirin adalah absensi GPS + selfie untuk UMKM dan bisnis dengan karyawan lapangan di Indonesia — dibangun
        supaya pemilik usaha tahu persis siapa yang hadir, kapan, dan di mana, tanpa perlu perangkat tambahan atau
        tim IT.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {VALUES.map((value) => (
          <Card key={value.title}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <value.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-semibold text-text">{value.title}</h2>
            <p className="mt-1 text-sm text-muted">{value.description}</p>
          </Card>
        ))}
      </div>

      <Card shadow className="mt-10">
        <h2 className="font-semibold text-text">Kenapa kami membangun ini</h2>
        <p className="mt-2 text-sm text-muted">
          Banyak usaha kecil di Indonesia masih mencatat kehadiran lewat kertas, grup WhatsApp, atau mesin sidik jari
          yang mahal dan sering rusak. Semuanya sama-sama mudah dititipkan ke orang lain dan sulit direkap. Hadirin
          memindahkan proses itu ke HP karyawan sendiri, dengan verifikasi lokasi dan wajah yang tervalidasi di
          server — supaya pemilik usaha bisa percaya datanya tanpa harus mengawasi secara manual.
        </p>
      </Card>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <ButtonLink href="/register" size="lg">
          Mulai Gratis
        </ButtonLink>
        <ButtonLink href="/pricing" size="lg" variant="outline">
          Lihat Harga
        </ButtonLink>
      </div>
    </section>
  );
}
