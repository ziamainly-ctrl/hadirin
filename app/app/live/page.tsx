import type { Metadata } from 'next';
import { CalendarOff, ClockAlert, LogOut, Radio, UserCheck, UserX } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getBranchPresence, getHolidayNameOn, getLiveSummary, listPunchEventsForDay } from '@/lib/queries/live';
import { todayInZone } from '@/app/m/format';
import ButtonLink from '@/components/ui/ButtonLink';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import StatTile from '@/components/shared/StatTile';
import AutoRefresh from '@/components/shared/AutoRefresh';
import LiveFeed from './live-feed';
import BranchPresenceList from './branch-presence';

export const metadata: Metadata = { title: 'Live' };

const FEED_LIMIT = 60;

/**
 * Real-time activity: what is happening right now, punch by punch (the Dashboard is the summary
 * of the day; this is the stream). Server Component reading lib/queries/live.ts directly
 * (TRD.md §5); <AutoRefresh> re-renders it every 15 s with router.refresh(), so there is no
 * client data layer and no cache to bust (a punch shows on the next tick, not after a 20 s TTL).
 * OWNER/ADMIN see the whole org; a MANAGER only their direct reports (AGENTS.md domain rule #2;
 * app/app/layout.tsx already sends an EMPLOYEE to /m).
 */
export default async function LivePage() {
  const { orgId, userId, role } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);
  const isOrgWide = ORG_WIDE_ROLES.includes(role);
  const managerId = isOrgWide ? undefined : userId;

  const org = await getOrganizationPlanContext(orgId);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const workDate = todayInZone(timeZone);

  const generatedAt = new Date();
  const [events, branches, summary, holidayName] = await Promise.all([
    listPunchEventsForDay(orgId, workDate, timeZone, managerId, FEED_LIMIT),
    getBranchPresence(orgId, workDate, timeZone, managerId),
    getLiveSummary(orgId, workDate, timeZone, managerId),
    getHolidayNameOn(orgId, workDate),
  ]);

  const nobodyScheduled = summary.expected === 0 && events.length === 0;
  const teamWord = isOrgWide ? 'karyawan' : 'anggota tim';

  return (
    <Page>
      <Page.Header
        title="Live"
        description={
          holidayName
            ? `Aktivitas check-in dan check-out hari ini. Hari ini libur (${holidayName}); absen tetap dicatat tanpa hitungan terlambat.`
            : 'Aktivitas check-in dan check-out hari ini, diperbarui otomatis.'
        }
        actions={<AutoRefresh generatedAt={generatedAt.toISOString()} timeZone={timeZone} />}
      />

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Sedang di lokasi"
          value={summary.onSite}
          subLabel={`dari ${summary.expected} terjadwal`}
          icon={<UserCheck className="h-4 w-4" aria-hidden="true" />}
        />
        {/* Every tile carries a sub-line: a tile without one sits its number lower than its neighbours' (the
            number is bottom-aligned), and four numbers on one baseline read as one row. */}
        <StatTile
          label="Sudah pulang"
          value={summary.checkedOut}
          subLabel="sudah check-out"
          icon={<LogOut className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Terlambat"
          value={summary.late}
          subLabel="melewati toleransi"
          icon={<ClockAlert className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Belum hadir"
          value={summary.notYetIn}
          subLabel={summary.away > 0 ? `${summary.away} cuti/izin/libur` : 'belum check-in'}
          icon={<UserX className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <Page.Body>
        {nobodyScheduled ? (
          <EmptyState
            icon={CalendarOff}
            className="lg:flex-1 lg:justify-center"
            message={
              isOrgWide
                ? 'Belum ada karyawan terjadwal hari ini. Tambahkan karyawan dan tetapkan shift, atau jadwalkan diri Anda sendiri, agar aktivitas muncul di sini.'
                : 'Belum ada anggota tim yang terjadwal hari ini.'
            }
            action={
              isOrgWide ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/app/employees">Kelola Karyawan</ButtonLink>
                  <ButtonLink href="/app/check-in" variant="outline">
                    Siapkan Check-in Saya
                  </ButtonLink>
                </div>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-1">
            {/* The card frame written out (not <Card>): Card bakes in p-4 and a second padding class
                would tie with it on specificity, so a card whose header and list go edge to edge
                cannot be a <Card className="p-0">. */}
            <section className="flex flex-col rounded-card border border-border bg-surface lg:min-h-0 lg:overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-text">Aktivitas terbaru</h2>
                <span className="text-xs tabular-nums text-muted">
                  {events.length >= FEED_LIMIT ? `${FEED_LIMIT} terbaru` : `${events.length} aktivitas`}
                </span>
              </div>
              {events.length === 0 ? (
                <EmptyState
                  icon={Radio}
                  className="lg:flex-1 lg:justify-center"
                  message={`Belum ada aktivitas hari ini. Check-in pertama dari ${teamWord} akan muncul di sini.`}
                />
              ) : (
                <LiveFeed events={events} timeZone={timeZone} nowMs={generatedAt.getTime()} linkNames={isOrgWide} />
              )}
            </section>

            <section className="flex flex-col rounded-card border border-border bg-surface lg:min-h-0 lg:overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-text">Per cabang</h2>
                <span className="text-xs text-muted">Orang di lokasi</span>
              </div>
              <div className="flex flex-col p-4 lg:min-h-0 lg:flex-1">
                <BranchPresenceList branches={branches} canManageBranches={isOrgWide} />
              </div>
            </section>
          </div>
        )}
      </Page.Body>
    </Page>
  );
}
