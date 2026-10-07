import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { getLocalParts } from '@/lib/tz';
import Page from '@/components/shared/Page';
import DashboardClient from './dashboard-client';

export const metadata: Metadata = { title: 'Dashboard' };

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

// Server Component (TRD.md R1 / AGENTS.md hard rules): reads the session and org
// context directly through lib/queries (TRD.md §5), never a self-fetch over HTTP.
// The 30s-polling stat tiles and table are client-only (PRD.md A1/US-03: "refresh
// every 30s without a full reload"), so this page only renders the static header
// around <DashboardClient>, which owns the live data itself. On desktop the page is one
// viewport tall (Page frame): tiles and donut stay put and only the attendance table scrolls.
export default async function DashboardPage() {
  const { orgId, userId } = await requireSession();
  const [org, me] = await Promise.all([getOrganizationPlanContext(orgId), getUserByIdInOrg(orgId, userId)]);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  // The greeting is for the person signed in (first name), not the organization: a long
  // clinic name as "Halo, …" wrapped to two lines on a phone and read like a letterhead.
  const firstName = shortName(me.name);

  return (
    <Page>
      <Page.Header
        title={`${greetingFor(getLocalParts(new Date(), timeZone).hour)}, ${firstName}`}
        description={
          <>
            Pantau siapa yang sudah hadir, terlambat, atau belum datang hari ini
            {org ? <> di {org.name}</> : null}.
          </>
        }
      />
      <Page.Body>
        <DashboardClient orgTimezone={timeZone} />
      </Page.Body>
    </Page>
  );
}
