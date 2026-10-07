import type { Metadata } from 'next';
import { MapPin, Camera, Rocket } from 'lucide-react';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import { IconCard, PageHead, PageSection } from '../marketing-page';

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
    description: 'Selfie wajib di setiap absen masuk dan pulang, jadi kehadiran tidak bisa diwakilkan orang lain.',
  },
  {
    icon: Rocket,
    title: 'Cepat dipakai',
    description: 'Tanpa mesin sidik jari dan tanpa tim IT. Daftar, atur cabang dan shift, langsung jalan.',
  },
];

export default function AboutPage() {
  return (
    <PageSection>
      <PageHead
        title="Tentang Hadirin"
        description="Hadirin adalah absensi GPS + selfie untuk UMKM dan bisnis dengan karyawan lapangan di Indonesia. Kami membangunnya supaya pemilik usaha tahu persis siapa yang hadir, kapan, dan di mana, tanpa perangkat tambahan atau tim IT."
        actions={
          <>
            <ButtonLink href="/register" className="w-full sm:w-auto">
              Mulai Gratis
            </ButtonLink>
            <ButtonLink href="/pricing" variant="outline" className="w-full sm:w-auto">
              Lihat Harga
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3 lg:gap-[clamp(0.5rem,calc(3vh-0.5rem),1rem)]">
        {VALUES.map((value) => (
          <IconCard key={value.title} icon={value.icon} title={value.title} description={value.description} />
        ))}
      </div>

      <Card shadow className="p-5 lg:p-6">
        <h2 className="text-lg font-semibold text-text">Kenapa kami membangun ini</h2>
        <p className="mt-2 text-pretty text-sm text-muted">
          Banyak usaha kecil di Indonesia masih mencatat kehadiran lewat kertas, grup WhatsApp, atau mesin sidik jari
          yang mahal dan sering rusak. Semuanya sama-sama mudah dititipkan ke orang lain dan sulit direkap. Hadirin
          memindahkan proses itu ke HP karyawan sendiri, dengan lokasi dan foto yang dicek di server, supaya pemilik
          usaha bisa percaya datanya tanpa harus mengawasi secara manual.
        </p>
      </Card>
    </PageSection>
  );
}
