import { Package } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { listAllPlans } from '@/lib/queries/plans';
import PlanFormDialog, { SortablePlansTable } from './plan-form-dialog';

/**
 * Server Component: calls listAllPlans() directly (TRD.md §5) — the same call
 * GET /api/platform/plans makes, including inactive plans (unlike the public pricing
 * page's listActivePlans()). Drag-to-reorder and the create/edit dialog are client
 * leaves in ./plan-form-dialog.tsx (PRD.md P2); this page only fetches and lays out
 * the shell.
 */
export default async function PlansPage() {
  const plans = await listAllPlans();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Paket</h1>
          <p className="text-sm text-muted">Kelola paket berlangganan, harga, batas, dan fitur.</p>
        </div>
        <PlanFormDialog nextSortOrder={plans.length} />
      </div>

      {plans.length === 0 ? (
        <EmptyState icon={Package} message="Belum ada paket." />
      ) : (
        <SortablePlansTable plans={plans} />
      )}
    </div>
  );
}
