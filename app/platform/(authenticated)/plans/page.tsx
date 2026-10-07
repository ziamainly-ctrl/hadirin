import type { Metadata } from 'next';
import { Package } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import { listAllPlans } from '@/lib/queries/plans';
import PlanFormDialog, { SortablePlansTable } from './plan-form-dialog';

export const metadata: Metadata = { title: 'Paket' };

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
    <Page>
      <Page.Header
        title="Paket"
        description="Kelola paket berlangganan, harga, batas, dan fitur."
        actions={<PlanFormDialog nextSortOrder={plans.length} />}
      />

      <Page.Body>
        {plans.length === 0 ? (
          <EmptyState icon={Package} message="Belum ada paket." />
        ) : (
          <SortablePlansTable plans={plans} />
        )}
      </Page.Body>
    </Page>
  );
}
