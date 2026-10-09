import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { requirePageRole } from '@/lib/page-guard';
import { listInvoicesForOrg } from '@/lib/queries/invoices';
import type { Invoice } from '@/lib/queries/invoices';
import { listActivePaymentMethods } from '@/lib/queries/payment-methods';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getPlanById } from '@/lib/queries/plans';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import type { InvoiceStatus } from '@/lib/constants/statuses';
import { toCalendarDate } from '../../attendance/format';
import CheckoutButton from './checkout-button';

export const metadata: Metadata = { title: 'Tagihan' };

const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

// timeZone: 'UTC' keeps a pure calendar date from shifting a day under a viewer's
// local offset — same reasoning as components/shared/RequestCard.tsx's date formatter. The
// value goes through toCalendarDate first: the driver returns a DATE column as a JS Date at
// server-local midnight, so on an Asia/Jakarta server 1 Nov used to print as "31 Okt".
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: 'Menunggu',
  PAID: 'Lunas',
  EXPIRED: 'Kedaluwarsa',
  FAILED: 'Gagal',
  REFUNDED: 'Dikembalikan',
};

// Invoice status is not an attendance status, so it is the shared neutral Badge (no tinted
// fills, product-owner rule) with a small dot whose color carries the state; the label stays
// the primary cue, never the dot alone.
const INVOICE_STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  PENDING: 'warning',
  PAID: 'success',
  EXPIRED: 'neutral',
  FAILED: 'danger',
  REFUNDED: 'info',
};

function formatCalendarDate(value: string): string {
  return DATE_FORMATTER.format(new Date(toCalendarDate(value)));
}

function formatPeriod(periodStart: string, periodEnd: string): string {
  return `${formatCalendarDate(periodStart)} – ${formatCalendarDate(periodEnd)}`;
}

function InvoiceStatusBadge({ invoice }: { invoice: Invoice }) {
  return <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>;
}

// Server Component, OWNER only (TRD.md §6 marks billing routes OWNER-only).
export default async function BillingSettingsPage() {
  const { orgId } = await requirePageRole(['OWNER'], '/app/settings');

  const [invoices, methods, org] = await Promise.all([
    listInvoicesForOrg(orgId),
    listActivePaymentMethods(),
    getOrganizationPlanContext(orgId),
  ]);
  const plan = org ? await getPlanById(org.planId) : null;
  // Same date shape as the invoice periods; a TIMESTAMPTZ shown in the org's own zone.
  const validUntil = org?.planExpiresAt ?? org?.trialEndsAt ?? null;
  const validUntilLabel = validUntil
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: org?.timezone ?? 'Asia/Jakarta',
      }).format(new Date(validUntil))
    : null;

  return (
    <Page>
      <Page.Header title="Tagihan" description="Paket langganan, pembayaran, dan riwayat tagihan." />

      <Page.Body>
        <Card className="shrink-0">
          <h2 className="mb-3 text-sm font-semibold text-text">
            Bayar Paket<span className="font-normal text-muted"> · pilih metode pembayaran</span>
          </h2>
          <CheckoutButton
            methods={methods}
            summary={
              <div className="flex flex-col gap-3 text-sm">
                <dl className="flex flex-col gap-3">
                  {plan ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Paket</dt>
                      <dd className="mt-0.5 font-semibold text-text">{plan.name}</dd>
                      <dd className="tabular-nums text-text">{RUPIAH.format(plan.priceMonthly)}/bulan</dd>
                    </div>
                  ) : null}
                  {validUntilLabel ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Berlaku sampai</dt>
                      <dd className="mt-0.5 text-text">{validUntilLabel}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="text-muted">Biaya admin ditambahkan sesuai metode pembayaran.</p>
              </div>
            }
          />
        </Card>

        {/* min-h-36: on a very short window the section keeps room for its heading, the sticky
            head and a row or two; below that the page body scrolls instead of crushing it. */}
        <section
          className="flex flex-col gap-3 lg:min-h-36 lg:flex-1"
          aria-labelledby="invoice-history-title"
        >
          <h2 id="invoice-history-title" className="shrink-0 text-sm font-semibold text-text">
            Riwayat Tagihan
          </h2>
          {invoices.length === 0 ? (
            <Card>
              <EmptyState
                icon={FileText}
                message="Belum ada tagihan. Tagihan pertama muncul setelah Anda membayar paket."
              />
            </Card>
          ) : (
            <>
              {/* Phones: one card per invoice, so amount and status aren't scrolled off. */}
              <ul className="flex flex-col gap-2 md:hidden">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium tabular-nums text-text">{invoice.invoiceCode}</span>
                      <InvoiceStatusBadge invoice={invoice} />
                    </div>
                    <p className="text-sm text-muted">{formatPeriod(invoice.periodStart, invoice.periodEnd)}</p>
                    <p className="text-sm font-medium tabular-nums text-text">{RUPIAH.format(invoice.totalAmount)}</p>
                  </li>
                ))}
              </ul>

              <div className="hidden md:contents">
                <Table aria-label="Riwayat tagihan">
                  <Table.Head>
                    <Table.Row>
                      <Table.HeadCell>Kode</Table.HeadCell>
                      <Table.HeadCell>Periode</Table.HeadCell>
                      <Table.HeadCell className="text-right">Jumlah</Table.HeadCell>
                      <Table.HeadCell>Status</Table.HeadCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {invoices.map((invoice) => (
                      <Table.Row key={invoice.id}>
                        <Table.Cell className="font-medium">{invoice.invoiceCode}</Table.Cell>
                        <Table.Cell>{formatPeriod(invoice.periodStart, invoice.periodEnd)}</Table.Cell>
                        <Table.Cell className="text-right">{RUPIAH.format(invoice.totalAmount)}</Table.Cell>
                        <Table.Cell>
                          <InvoiceStatusBadge invoice={invoice} />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </>
          )}
        </section>
      </Page.Body>
    </Page>
  );
}
