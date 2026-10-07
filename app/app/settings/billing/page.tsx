import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listInvoicesForOrg } from '@/lib/queries/invoices';
import { listActivePaymentMethods } from '@/lib/queries/payment-methods';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/shared/EmptyState';
import type { InvoiceStatus } from '@/lib/constants/statuses';
import CheckoutButton from './checkout-button';

export const metadata: Metadata = { title: 'Billing' };

const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

// timeZone: 'UTC' keeps a pure calendar date from shifting a day under a viewer's
// local offset — same reasoning as components/shared/RequestCard.tsx's date formatter.
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

// Invoice status is not an attendance status, so this is a plain Badge with its own
// color chosen per status — components/shared/StatusBadge.tsx's --color-status-*
// tokens (TRD.md §14) are reserved for attendance and don't cover billing states.
const INVOICE_STATUS_CLASSES: Record<InvoiceStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  EXPIRED: 'bg-black/5 dark:bg-white/5 text-muted',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  REFUNDED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};

function formatPeriod(periodStart: string, periodEnd: string): string {
  return `${DATE_FORMATTER.format(new Date(periodStart))} – ${DATE_FORMATTER.format(new Date(periodEnd))}`;
}

// Server Component, OWNER only (TRD.md §6 marks billing routes OWNER-only).
export default async function BillingSettingsPage() {
  const { orgId } = await requireSession(['OWNER']);

  const [invoices, methods] = await Promise.all([listInvoicesForOrg(orgId), listActivePaymentMethods()]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-text">Billing</h1>
      <p className="mt-1 text-sm text-muted">Riwayat tagihan dan pembayaran paket.</p>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-text">Riwayat Tagihan</h2>
      {invoices.length === 0 ? (
        <EmptyState icon={FileText} message="Belum ada tagihan." />
      ) : (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Kode</Table.HeadCell>
              <Table.HeadCell>Periode</Table.HeadCell>
              <Table.HeadCell>Jumlah</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {invoices.map((invoice) => (
              <Table.Row key={invoice.id}>
                <Table.Cell className="font-medium">{invoice.invoiceCode}</Table.Cell>
                <Table.Cell>{formatPeriod(invoice.periodStart, invoice.periodEnd)}</Table.Cell>
                <Table.Cell>{RUPIAH.format(invoice.totalAmount)}</Table.Cell>
                <Table.Cell>
                  <Badge className={INVOICE_STATUS_CLASSES[invoice.status]}>
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <Card className="mt-6">
        <Card.Header>
          <h2 className="text-sm font-semibold text-text">Bayar Tagihan</h2>
        </Card.Header>
        <Card.Body>
          <CheckoutButton methods={methods} />
        </Card.Body>
      </Card>
    </div>
  );
}
