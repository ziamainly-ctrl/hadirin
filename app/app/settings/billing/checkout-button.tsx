'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Button from '@/components/ui/Button';
import Radio from '@/components/ui/Radio';
import { useToast } from '@/components/ui/Toast';

export interface CheckoutButtonMethod {
  id: number;
  name: string;
  adminFeeFlat: number;
  adminFeePct: number;
}

export interface CheckoutButtonProps {
  methods: CheckoutButtonMethod[];
  /** What the admin is paying for (plan, price, valid-until): built by the server page and
   * shown beside the pay button on desktop, above the method list on a phone. */
  summary?: ReactNode;
}

const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
// id-ID decimal comma, no trailing zeros: 0.70 -> "0,7", 2.00 -> "2".
const PERCENT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

// TRD.md §9 step 1: the picker must show each method's fee before checkout, since
// the fee is locked into gross_amount once the Snap token is created.
//
// Number(): admin_fee_pct is a NUMERIC column, which the Neon driver returns as a
// string ("0.00") despite the `number` type — and a non-empty string is truthy, which
// is how "Rp 4.000 + 0.00%" used to appear for flat-fee-only methods.
function feeLabel(method: CheckoutButtonMethod): string {
  const flat = Number(method.adminFeeFlat) || 0;
  const pct = Number(method.adminFeePct) || 0;
  if (!flat && !pct) return 'Tanpa biaya admin';
  const parts: string[] = [];
  if (flat) parts.push(RUPIAH.format(flat));
  if (pct) parts.push(`${PERCENT.format(pct)}%`);
  return `Biaya admin ${parts.join(' + ')}`;
}

// Client leaf: picks a payment method, then POSTs /api/billing/checkout (TRD.md §9
// steps 1-3). On success a plain window.location.href redirect to Midtrans's hosted
// Snap page is a complete checkout flow on its own — no snap.js popup, no inline embed.
export default function CheckoutButton({ methods, summary }: CheckoutButtonProps) {
  const { show } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(methods[0]?.id ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCheckout() {
    if (!selectedId) {
      show('Pilih metode pembayaran terlebih dahulu.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: selectedId }),
      });
      const json = await res.json();
      if (!res.ok) {
        show(json.error?.message ?? 'Gagal memulai pembayaran.', 'error');
        setIsSubmitting(false);
        return;
      }
      const redirectUrl = json.data?.invoice?.snapRedirectUrl;
      if (!redirectUrl) {
        show('Tautan pembayaran tidak tersedia. Coba lagi.', 'error');
        setIsSubmitting(false);
        return;
      }
      window.location.href = redirectUrl;
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
      setIsSubmitting(false);
    }
  }

  if (methods.length === 0) {
    return <p className="text-sm text-muted">Belum ada metode pembayaran yang tersedia. Silakan hubungi tim Hadirin.</p>;
  }

  // lg: methods on the left, summary + pay button stacked on the right, so the card is about
  // four rows tall instead of a stack of header, methods and button (the invoice history under
  // it then fits a short desktop screen). Below lg the DOM order is summary, methods, button.
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem] lg:grid-rows-[auto_1fr]">
      <fieldset className="order-2 flex flex-col gap-2 border-0 p-0 lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1">
        {/* The visible prompt is the card title in page.tsx ("Bayar Paket · pilih metode pembayaran"),
            which keeps a row of height on a short screen; the legend still names the group for
            screen readers. */}
        <legend className="sr-only">Metode Pembayaran</legend>
        {/* Two columns from sm: eight methods in one long stack pushed the pay button far
            below the fold. Each row is a full-width 44px+ touch target. */}
        <div className="grid gap-2 sm:grid-cols-2">
          {methods.map((method) => (
            <label
              key={method.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-input border border-border px-3 py-1.5 text-sm text-text transition-colors hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-accent/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
            >
              <Radio
                name="paymentMethodId"
                value={method.id}
                checked={selectedId === method.id}
                onChange={() => setSelectedId(method.id)}
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{method.name}</span>
                <span className="text-xs text-muted">{feeLabel(method)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {summary ? <div className="order-1 lg:order-none lg:col-start-2 lg:row-start-1">{summary}</div> : null}
      <Button
        type="button"
        onClick={handleCheckout}
        isLoading={isSubmitting}
        className="order-3 w-full lg:order-none lg:col-start-2 lg:row-start-2 lg:self-end"
      >
        Bayar Sekarang
      </Button>
    </div>
  );
}
