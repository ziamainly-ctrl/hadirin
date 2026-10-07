import type { Metadata } from 'next';
import ButtonLink from '@/components/ui/ButtonLink';
import { FEATURES, STEPS } from '../marketing-content';
import { IconCard, PageHead, PageSection } from '../marketing-page';

export const metadata: Metadata = {
  title: 'Fitur',
  description: 'Geofence, selfie wajib, dashboard langsung, persetujuan satu klik, dan rekap bulanan untuk absensi UMKM.',
};

export default function FeaturesPage() {
  return (
    <PageSection>
      <PageHead
        title="Semua yang dibutuhkan tim lapangan"
        description="Absensi yang jujur tanpa mesin sidik jari: lokasi dicek di server, wajah difoto di tempat."
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-[clamp(0.5rem,calc(3vh-0.5rem),1rem)]">
        {FEATURES.map((feature) => (
          <IconCard key={feature.title} icon={feature.icon} title={feature.title} description={feature.description} />
        ))}
      </div>

      {/* The three steps are a group of their own: a hidden h2 names it for a screen reader's
          heading list, and the step titles sit one level under it (h3), apart from the features' h2s. */}
      <h2 className="sr-only">Cara memulai</h2>
      <ol className="grid gap-4 md:grid-cols-3 lg:gap-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold tabular-nums text-primary-fg">
              {i + 1}
            </span>
            <div>
              <h3 className="font-semibold text-text">{step.title}</h3>
              <p className="mt-0.5 text-sm text-muted">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </PageSection>
  );
}
