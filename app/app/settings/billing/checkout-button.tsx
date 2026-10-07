'use client';

import { useState } from 'react';
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
}

const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

// TRD.md §9 step 1: the picker must show each method's fee before checkout, since
// the fee is locked into gross_amount once the Snap token is created.
function feeLabel(method: CheckoutButtonMethod): string {
  if (!method.adminFeeFlat && !method.adminFeePct) return 'Tanpa biaya admin';
  const parts: string[] = [];
  if (method.adminFeeFlat) parts.push(RUPIAH.format(method.adminFeeFlat));
  if (method.adminFeePct) parts.push(`${method.adminFeePct}%`);
  return `Biaya admin: ${parts.join(' + ')}`;
}

// Client leaf: picks a payment method, then POSTs /api/billing/checkout (TRD.md §9
// steps 1-3). On success a plain window.location.href redirect to Midtrans's hosted
// Snap page is a complete checkout flow on its own — no snap.js popup, no inline embed.
export default function CheckoutButton({ methods }: CheckoutButtonProps) {
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
    return <p className="text-sm text-muted">Belum ada metode pembayaran aktif.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {methods.map((method) => (
          <label
            key={method.id}
            className="flex items-center justify-between gap-3 rounded-input border border-border px-3 py-2 text-sm text-text"
          >
            <span className="flex items-center gap-2">
              <Radio
                name="paymentMethodId"
                value={method.id}
                checked={selectedId === method.id}
                onChange={() => setSelectedId(method.id)}
              />
              {method.name}
            </span>
            <span className="text-xs text-muted">{feeLabel(method)}</span>
          </label>
        ))}
      </div>
      <Button type="button" onClick={handleCheckout} isLoading={isSubmitting} className="self-start">
        Bayar Sekarang
      </Button>
    </div>
  );
}
