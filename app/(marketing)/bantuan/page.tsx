import type { Metadata } from 'next';
import ButtonLink from '@/components/ui/ButtonLink';
import { FAQ } from '../marketing-content';
import { PageHead, PageSection } from '../marketing-page';

export const metadata: Metadata = {
  title: 'Bantuan',
  description: 'Jawaban atas pertanyaan yang paling sering diajukan tentang absensi GPS + selfie Hadirin.',
};

// Six short answers stay open on the page (NN/g: an accordion hides content people need to
// scan; it only pays off for long answers) in two columns so the page fits one desktop screen.
export default function HelpPage() {
  return (
    <PageSection>
      <PageHead
        title="Pusat Bantuan"
        description="Hal yang paling sering ditanyakan sebelum dan sesudah mulai memakai Hadirin."
        actions={
          <>
            <ButtonLink href="/check-in" className="w-full sm:w-auto">
              Check-in Sekarang
            </ButtonLink>
            <ButtonLink href="/fitur" variant="outline" className="w-full sm:w-auto">
              Lihat Fitur
            </ButtonLink>
          </>
        }
      />

      <dl className="grid gap-x-10 gap-y-5 md:grid-cols-2 lg:gap-y-[clamp(0.5rem,calc(4vh-0.75rem),1.5rem)]">
        {FAQ.map((item) => (
          <div key={item.q} className="border-t border-border pt-3 lg:pt-4">
            <dt className="font-semibold text-text">{item.q}</dt>
            <dd className="mt-1.5 text-sm text-muted">{item.a}</dd>
          </div>
        ))}
      </dl>
    </PageSection>
  );
}
