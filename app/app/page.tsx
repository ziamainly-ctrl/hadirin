import type { Metadata } from 'next';
import { Fingerprint, Radio } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { formatLongDate } from '@/lib/insights/calendar-grid';
import { getSetupProgress } from '@/lib/queries/dashboard-insights';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { safeTimezone } from '@/lib/safe-timezone';
import { getLocalParts } from '@/lib/tz';
import AutoRefresh from '@/components/shared/AutoRefresh';
import Page from '@/components/shared/Page';
import ButtonLink from '@/components/ui/ButtonLink';
import DashboardView from './dashboard/DashboardView';
import { loadDashboard } from './dashboard/data';

export const metadata: Metadata = { title: 'Dashboard' };

/** The dashboard re-renders on the server this often (router.refresh()); a punch shows within one tick. */
const REFRESH_MS = 30_000;

// Indonesian time-of-day greeting for the org's own clock (malam until 4, pagi until 11, siang
// until 15, sore until 18, then malam again; "pagi" at 2 a.m. read wrong to a night-shift admin) — the same words a receptionist would use at that hour.
function greetingFor(hour: number): string {
  if (hour < 4) return 'Selamat malam';
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

// First name with any leading title kept ("dr. Hendra Wijaya" → "dr. Hendra"): in
// Indonesian a title such as dr./Ir./H. is part of a polite address, and the bare first
// token alone would have greeted the user as "dr.".
function shortName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const nameIndex = words.findIndex((word) => !word.endsWith('.'));
  return nameIndex === -1 ? fullName.trim() : words.slice(0, nameIndex + 1).join(' ');
}

// Server Component (TRD.md R1 / AGENTS.md hard rules): reads the session and the numbers directly
// through lib/queries (TRD.md section 5), never a self-fetch over HTTP. Everything the page shows is
// built in one parallel round by app/app/dashboard/data.ts (the roster from the 20 s `dash:` cache,
// the rest small org-scoped aggregates; a MANAGER's numbers are cut to direct reports), and
// <AutoRefresh> re-renders it every 30 s without a full reload (PRD.md A1/US-03). On desktop the page
// is exactly one viewport tall: the KPI strip and the cards share the height the Page frame leaves.
export default async function DashboardPage() {
  const { orgId, userId, role } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);
  const [org, me] = await Promise.all([getOrganizationPlanContext(orgId), getUserByIdInOrg(orgId, userId)]);
  const timeZone = safeTimezone(org?.timezone ?? 'Asia/Jakarta');

  const data = await loadDashboard({ orgId, userId, role, timeZone });
  // The "Mulai di sini" checklist is only worth four counts when there is nothing else to show.
  const setup = data.empty ? await getSetupProgress(orgId, userId) : null;

  // The greeting is for the person signed in (first name), not the organization: a long
  // clinic name as "Halo, …" wrapped to two lines on a phone and read like a letterhead.
  const title = `${greetingFor(getLocalParts(new Date(), timeZone).hour)}, ${shortName(me.name)}`;
  const scopeNote = data.orgWide ? (org ? ` · ${org.name}` : '') : ' · tim Anda';

  return (
    <Page>
      <Page.Header
        title={title}
        description={
          <>
            {formatLongDate(data.today)}
            {scopeNote}
            {data.holidayName ? ` · libur: ${data.holidayName}` : ''}
          </>
        }
        actions={
          <>
            <AutoRefresh intervalMs={REFRESH_MS} generatedAt={data.generatedAt} timeZone={timeZone} />
            <ButtonLink href="/app/check-in" variant="outline" size="sm">
              <Fingerprint className="h-4 w-4" aria-hidden="true" />
              Check-in Saya
            </ButtonLink>
            <ButtonLink href="/app/live" variant="outline" size="sm">
              <Radio className="h-4 w-4" aria-hidden="true" />
              Lihat Live
            </ButtonLink>
          </>
        }
      />
      <Page.Body>
        <DashboardView data={data} setup={setup} />
      </Page.Body>
    </Page>
  );
}
