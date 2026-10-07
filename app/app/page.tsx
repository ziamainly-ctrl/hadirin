import { requireSession } from '@/lib/auth';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import DashboardClient from './dashboard-client';

// Server Component (TRD.md R1 / AGENTS.md hard rules): reads the session and org
// context directly through lib/queries (TRD.md §5), never a self-fetch over HTTP.
// The 30s-polling stat tiles and table are client-only (PRD.md A1/US-03: "refresh
// every 30s without a full reload"), so this page only renders the static header
// around <DashboardClient>, which owns the live data itself.
export default async function DashboardPage() {
  const { orgId } = await requireSession();
  const org = await getOrganizationPlanContext(orgId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">{org ? `Halo, ${org.name}` : 'Dashboard'}</h1>
        <p className="mt-1 text-sm text-muted">Pantau kehadiran karyawan secara langsung hari ini.</p>
      </div>
      <DashboardClient orgTimezone={org?.timezone ?? 'Asia/Jakarta'} />
    </div>
  );
}
