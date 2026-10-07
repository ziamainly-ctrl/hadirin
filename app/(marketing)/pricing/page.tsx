import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { listActivePlans } from '@/lib/queries/plans';

export const metadata: Metadata = {
  title: 'Harga',
  description: 'Harga Hadirin — mulai gratis, upgrade kapan saja. Tanpa kontrak, batalkan kapan saja.',
};

const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function featureLines(features: { export_pdf: boolean; email_alerts: boolean; whatsapp_alerts: boolean; template_override: boolean }) {
  const lines = ['Export rekap XLSX'];
  if (features.export_pdf) lines.push('Export rekap PDF');
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
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-text">Harga</h1>
      <p className="mx-auto mt-2 max-w-md text-center text-muted">
        Mulai gratis, upgrade kapan saja. Tanpa kontrak.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {plans.map((plan, i) => (
          <Card key={plan.id} shadow className={`relative ${i === 1 ? 'ring-2 ring-primary' : ''}`}>
            {i === 1 ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
                Paling Populer
              </span>
            ) : null}
            <h2 className="text-lg font-semibold text-text">{plan.name}</h2>
            <p className="mt-2 text-3xl font-bold text-text">
              {plan.priceMonthly === 0 ? 'Gratis' : RUPIAH.format(plan.priceMonthly)}
              {plan.priceMonthly > 0 ? <span className="text-sm font-normal text-muted">/bulan</span> : null}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-text">
              <li className="flex gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Hingga {plan.maxEmployees} karyawan
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Hingga {plan.maxBranches} cabang
              </li>
              {featureLines(plan.features).map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            <Link href="/register" className="mt-6 block">
              <Button className="w-full" variant={i === 1 ? 'primary' : 'secondary'}>
                Pilih {plan.name}
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
