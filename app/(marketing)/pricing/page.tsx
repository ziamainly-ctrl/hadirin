import type { Metadata } from 'next';
import { Check, Tags } from 'lucide-react';
import ButtonLink from '@/components/ui/ButtonLink';
import EmptyState from '@/components/shared/EmptyState';
import Card from '@/components/ui/Card';
import { listActivePlans } from '@/lib/queries/plans';
import type { Plan } from '@/lib/queries/plans';
import { PageHead, PageSection } from '../marketing-page';

export const metadata: Metadata = {
  title: 'Harga',
  description: 'Harga Hadirin — mulai gratis, naik paket kapan saja. Tanpa kontrak, batalkan kapan saja.',
};

const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

// The plan every signup trials (register route, TRIAL_DAYS) — so it's the one we point at,
// tied to its code rather than to its position in the list, which the platform admin can
// reorder or shorten from /platform/plans.
const HIGHLIGHT_CODE = 'STARTER';

// One line per plan on who it's for, the first thing a visitor needs to pick between three
// cards. Keyed by the static plan codes (ERD seed); a plan added later from the CMS just
// shows no line instead of a wrong one.
const PLAN_FIT: Record<string, string> = {
  FREE: 'Untuk usaha kecil dengan satu lokasi.',
  STARTER: 'Untuk tim yang berkembang di beberapa cabang.',
  BUSINESS: 'Untuk usaha dengan banyak cabang dan notifikasi WhatsApp.',
};

// Every checklist line of a plan card: the two limits first, then the features it unlocks.
// Worded like the app itself ("Unduh Excel" / "Ekspor PDF" on the reports page). The two
// export formats share one line, which keeps the longest card (Business) to six lines so the
// three cards still fit a 1024x600 window.
function featureLines({ maxEmployees, maxBranches, features }: Plan) {
  const lines = [`Hingga ${maxEmployees} karyawan`, `Hingga ${maxBranches} cabang`];
  if (features.export_xlsx && features.export_pdf) lines.push('Rekap bulanan ke Excel dan PDF');
  else if (features.export_xlsx) lines.push('Rekap bulanan ke Excel');
  else if (features.export_pdf) lines.push('Rekap bulanan ke PDF');
  if (features.email_alerts) lines.push('Notifikasi email');
  if (features.whatsapp_alerts) lines.push('Notifikasi WhatsApp');
  if (features.template_override) lines.push('Kustomisasi template notifikasi');
  return lines;
}

// SSR, reads plans.ts directly (TRD.md §5 — Server Components call lib/queries directly,
// no self-fetch over HTTP) so pricing is never stale behind a client-side request.
export default async function PricingPage() {
  const plans = await listActivePlans();

  return (
    <PageSection>
      <PageHead
        title="Harga"
        description="Mulai gratis, naik paket kapan saja. Akun baru langsung mencoba paket Starter gratis 14 hari, tanpa kartu kredit dan tanpa kontrak."
      />

      {plans.length === 0 ? (
        <EmptyState icon={Tags} message="Daftar paket sedang diperbarui. Silakan cek lagi nanti." />
      ) : (
        // One column (capped at a card-friendly width) until lg: at md, three columns are
        // only ~230px each and the largest price ("Rp 299.000/bulan") ran past the card edge.
        // pt-3 leaves room for the "Paling Populer" badge that overhangs the top edge.
        <div className="mx-auto grid w-full max-w-md gap-8 pt-3 lg:max-w-none lg:grid-cols-3 lg:gap-6">
          {plans.map((plan) => {
            const highlighted = plan.code === HIGHLIGHT_CODE;
            return (
              <Card
                key={plan.id}
                shadow
                className={`relative flex flex-col p-5 lg:p-[clamp(1rem,2.4vh,1.5rem)] ${highlighted ? 'ring-2 ring-primary' : ''}`}
              >
                {highlighted ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
                    Paling Populer
                  </span>
                ) : null}
                <h2 className="break-words text-lg font-semibold text-text">{plan.name}</h2>
                {/* The one-line pitch is the first thing that goes on a short window (the cards
                    then stay inside 1024x600); min-h-10 = two text-sm lines, so side by side a
                    one-line and a two-line tagline don't put the three prices at different heights. */}
                {PLAN_FIT[plan.code] ? (
                  <p className="mt-1 text-pretty text-sm text-muted lg:min-h-10 lg:[@media(max-height:700px)]:hidden">
                    {PLAN_FIT[plan.code]}
                  </p>
                ) : null}
                <p className="mt-3 flex flex-wrap items-baseline gap-x-1 lg:[@media(max-height:700px)]:mt-1">
                  <span className="text-3xl font-bold tracking-tight tabular-nums text-text">
                    {RUPIAH.format(plan.priceMonthly)}
                  </span>
                  <span className="text-sm text-muted">/bulan</span>
                </p>
                <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm text-text">
                  {featureLines(plan).map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-text" aria-hidden="true" />
                      {line}
                    </li>
                  ))}
                </ul>
                {/* mt-auto inside the flex-col card pins every CTA to the card bottom, so the three
                    buttons line up on one baseline however many feature lines each plan has. */}
                <div className="mt-auto pt-5">
                  <ButtonLink href="/register" variant={highlighted ? 'primary' : 'outline'} className="w-full">
                    <span className="truncate">Pilih {plan.name}</span>
                  </ButtonLink>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageSection>
  );
}
