import type { Metadata } from 'next';
import { CreditCard } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import { listAllPaymentMethods } from '@/lib/queries/payment-methods';
import PaymentMethodFormDialog, { SortablePaymentMethodsTable } from './payment-method-form-dialog';

export const metadata: Metadata = { title: 'Metode Pembayaran' };

/**
 * Server Component: calls listAllPaymentMethods() directly (TRD.md §5) — the same call
 * GET /api/platform/payment-methods makes, including inactive methods (unlike the
 * billing picker's listActivePaymentMethods()). Drag-to-reorder and the create/edit
 * dialog are client leaves in ./payment-method-form-dialog.tsx (PRD.md P3); this page
 * only fetches and lays out the shell.
 */
export default async function PaymentMethodsPage() {
  const paymentMethods = await listAllPaymentMethods();

  return (
    <Page>
      <Page.Header
        title="Metode Pembayaran"
        description="Kelola metode pembayaran, biaya admin, dan urutan tampil saat checkout."
        actions={<PaymentMethodFormDialog nextSortOrder={paymentMethods.length} />}
      />

      <Page.Body>
        {paymentMethods.length === 0 ? (
          <EmptyState icon={CreditCard} message="Belum ada metode pembayaran." />
        ) : (
          <SortablePaymentMethodsTable paymentMethods={paymentMethods} />
        )}
      </Page.Body>
    </Page>
  );
}
