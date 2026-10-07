import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Page from '@/components/shared/Page';
import OrganizationForm from './organization-form';

export const metadata: Metadata = { title: 'Organisasi' };

const COUNT_FORMATTER = new Intl.NumberFormat('id-ID');

// Server Component (TRD.md §5): reads getOrganizationPlanContext() directly, no
// self-fetch over /api/organizations. OWNER/ADMIN only (AGENTS.md domain rule #2).
export default async function OrganizationSettingsPage() {
  const { orgId, role } = await requireSession(['OWNER', 'ADMIN']);

  const org = await getOrganizationPlanContext(orgId);
  if (!org) throw new Error('Organization not found');

  return (
    <Page>
      <Page.Header title="Organisasi" description="Nama, zona waktu, dan aturan absensi untuk seluruh organisasi." />

      <Page.Body>
        <Card>
          <OrganizationForm
            initialValues={{
              name: org.name,
              timezone: org.timezone,
              geofenceMode: org.geofenceMode,
              selfieRequired: org.selfieRequired,
              logoUrl: org.logoUrl,
            }}
          />
        </Card>

        {/* A one-line strip under the form rather than a second tall card: together they fit
            one 1024x600 screen, and the plan is context for the form, not a task of its own. */}
        <Card className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Paket Saat Ini</h2>
            <p className="mt-0.5 text-sm text-muted">
              <span className="text-base font-semibold text-text">{org.planName}</span>
              <span className="mx-2" aria-hidden="true">
                &middot;
              </span>
              Hingga {COUNT_FORMATTER.format(org.maxEmployees)} karyawan &middot; Hingga{' '}
              {COUNT_FORMATTER.format(org.maxBranches)} cabang
            </p>
          </div>
          {/* Billing is OWNER-only (TRD.md §6), so an ADMIN gets no link to a page that
              would refuse them. */}
          {role === 'OWNER' ? (
            <ButtonLink href="/app/settings/billing" variant="outline" size="sm">
              Lihat Tagihan
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          ) : null}
        </Card>
      </Page.Body>
    </Page>
  );
}
