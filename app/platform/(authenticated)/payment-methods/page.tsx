import { CreditCard } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { listAllPaymentMethods } from '@/lib/queries/payment-methods';
import PaymentMethodFormDialog, { SortablePaymentMethodsTable } from './payment-method-form-dialog';

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Metode Pembayaran</h1>
          <p className="text-sm text-muted">Kelola metode pembayaran, biaya admin, dan urutan tampil saat checkout.</p>
        </div>
        <PaymentMethodFormDialog nextSortOrder={paymentMethods.length} />
      </div>

      {paymentMethods.length === 0 ? (
        <EmptyState icon={CreditCard} message="Belum ada metode pembayaran." />
      ) : (
        <SortablePaymentMethodsTable paymentMethods={paymentMethods} />
      )}
    </div>
  );
}
