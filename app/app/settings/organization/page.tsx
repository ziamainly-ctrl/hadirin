import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import Card from '@/components/ui/Card';
import OrganizationForm from './organization-form';

export const metadata: Metadata = { title: 'Organisasi' };

// Server Component (TRD.md §5): reads getOrganizationPlanContext() directly, no
// self-fetch over /api/organizations. OWNER/ADMIN only (AGENTS.md domain rule #2).
export default async function OrganizationSettingsPage() {
  const { orgId } = await requireSession(['OWNER', 'ADMIN']);

  const org = await getOrganizationPlanContext(orgId);
  if (!org) throw new Error('Organization not found');

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-text">Organisasi</h1>
      <p className="mt-1 text-sm text-muted">Nama, zona waktu, dan aturan presensi untuk seluruh organisasi.</p>

      <Card className="mt-6">
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

      <Card className="mt-6">
        <Card.Header>
          <h2 className="text-sm font-semibold text-text">Paket Saat Ini</h2>
        </Card.Header>
        <Card.Body className="flex flex-col gap-1 text-sm text-text">
          <p className="text-base font-semibold">{org.planName}</p>
          <p className="text-muted">
            Hingga {org.maxEmployees} karyawan &middot; Hingga {org.maxBranches} cabang
          </p>
        </Card.Body>
        <Card.Footer>
          <Link href="/app/settings/billing" className="text-sm font-medium text-primary hover:underline">
            Lihat billing &rarr;
          </Link>
        </Card.Footer>
      </Card>
    </div>
  );
}
