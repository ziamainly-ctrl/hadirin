import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CircleCheck, ClockAlert, Fingerprint, History, Timer, UserX } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listAttendanceForOrg } from '@/lib/queries/attendance';
import type { AttendanceLogRow } from '@/lib/queries/attendance';
import { getMyMonthSummary } from '@/lib/queries/my-attendance';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { calendarDateToUtc, formatClock, todayInZone } from '@/app/m/format';
import { formatMinutes, toCalendarDate } from '@/app/app/attendance/format';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import ButtonLink from '@/components/ui/ButtonLink';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import StatTile from '@/components/shared/StatTile';
import SelfieLink from '@/components/shared/SelfieLink';

export const metadata: Metadata = { title: 'Riwayat Saya' };

// One server chunk; the client fit pager (components/shared/FitPager) splits it into screen-sized pages.
const PAGE_SIZE = 100;

interface RiwayatPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Pure calendar dates formatted through calendarDateToUtc + timeZone 'UTC', so a date never
// slides to the neighbouring day under some server or viewer offset (same convention as
// app/app/attendance/page.tsx).
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTH_FORMATTER = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function formatWorkDate(log: AttendanceLogRow): string {
  return DATE_FORMATTER.format(calendarDateToUtc(toCalendarDate(log.workDate)));
}

function ClockWithSelfie({ log, kind, timeZone }: { log: AttendanceLogRow; kind: 'check-in' | 'check-out'; timeZone: string }) {
  const at = kind === 'check-in' ? log.checkInAt : log.checkOutAt;
  const photo = kind === 'check-in' ? log.checkInPhotoUrl : log.checkOutPhotoUrl;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      {formatClock(at, timeZone)}
      {photo ? <SelfieLink logId={log.id} kind={kind} /> : null}
    </span>
  );
}

/**
 * The signed-in person's OWN attendance, newest first, with the month's totals above it. Open to
 * OWNER, ADMIN and MANAGER (an EMPLOYEE has /m/history; app/app/layout.tsx redirects them). The
 * person comes from the session, never from a query param (AGENTS.md domain rules #1 and #3), so
 * there is no way to read someone else's history through this page. The rows reuse
 * listAttendanceForOrg, the very query the org-wide Absensi table uses, so a status here always
 * means what it means there.
 */
export default async function RiwayatPage({ searchParams }: RiwayatPageProps) {
  const { orgId, userId, context } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);

  const org = await getOrganizationPlanContext(orgId);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const today = todayInZone(timeZone);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ rows, total }, summary] = await Promise.all([
    listAttendanceForOrg(orgId, { userId }, page, PAGE_SIZE),
    getMyMonthSummary(orgId, userId, monthStart),
  ]);

  // A page number past the end (a stale bookmark) goes to the last real page instead of showing an
  // empty table under a pager that says "Halaman 1 dari 1".
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > lastPage) redirect(lastPage > 1 ? `/app/riwayat?page=${lastPage}` : '/app/riwayat');

  const monthLabel = MONTH_FORMATTER.format(calendarDateToUtc(monthStart));
  const attended = summary.present + summary.late;

  return (
    <Page>
      <Page.Header title="Riwayat Saya" description="Catatan absensi Anda sendiri, dari yang terbaru." />

      <section aria-label={`Ringkasan ${monthLabel}`} className="flex shrink-0 flex-col gap-2">
        <h2 className="text-sm font-semibold capitalize text-text">{monthLabel}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Hadir"
            value={attended}
            subLabel={summary.workMinutes > 0 ? `Kerja ${formatMinutes(summary.workMinutes)}` : 'hari hadir'}
            icon={<CircleCheck className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Terlambat"
            value={summary.late}
            subLabel={summary.lateMinutes > 0 ? `Total ${formatMinutes(summary.lateMinutes)}` : 'hari terlambat'}
            icon={<ClockAlert className="h-4 w-4" aria-hidden="true" />}
          />
          {/* Every tile has a sub-line: a tile without one sits its number lower than its neighbours'. */}
          <StatTile
            label="Tidak hadir"
            value={summary.absent}
            subLabel="hari tanpa kabar"
            icon={<UserX className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Cuti/Sakit/Izin"
            value={summary.away}
            subLabel="hari disetujui"
            icon={<Timer className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </section>

      <Page.Body>
        {total === 0 ? (
          <EmptyState
            icon={History}
            className="lg:flex-1 lg:justify-center"
            message={
              context.shiftId
                ? 'Belum ada riwayat absensi. Riwayat muncul setelah Anda check-in.'
                : 'Akun Anda belum punya shift, jadi belum ada riwayat. Siapkan check-in untuk mulai mencatat kehadiran Anda.'
            }
            action={
              <ButtonLink href="/app/check-in">
                <Fingerprint className="h-4 w-4" aria-hidden="true" />
                {context.shiftId ? 'Buka Check-in' : 'Siapkan Check-in'}
              </ButtonLink>
            }
          />
        ) : (
          <>
            {/* Phones: a stacked row per day. As a seven-column table a 360px screen showed the
                date and status only, with the times off to the right. */}
            <ul className="divide-y divide-border rounded-card border border-border bg-surface sm:hidden">
              {rows.map((log) => (
                <li key={log.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-text">{formatWorkDate(log)}</p>
                    <StatusBadge status={log.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4">
                    <div className="flex items-center gap-1.5">
                      <dt className="text-muted">Masuk</dt>
                      <dd className="text-text">
                        <ClockWithSelfie log={log} kind="check-in" timeZone={timeZone} />
                      </dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="text-muted">Keluar</dt>
                      <dd className="text-text">
                        <ClockWithSelfie log={log} kind="check-out" timeZone={timeZone} />
                      </dd>
                    </div>
                  </dl>
                  {log.lateMinutes > 0 || log.workMinutes !== null ? (
                    <p className="text-xs tabular-nums text-muted">
                      {[
                        log.lateMinutes > 0 ? `Terlambat ${formatMinutes(log.lateMinutes)}` : null,
                        log.workMinutes !== null ? `Kerja ${formatMinutes(log.workMinutes)}` : null,
                      ]
                        .filter((item): item is string => item !== null)
                        .join(' · ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="hidden min-h-0 flex-col sm:flex">
              <Table aria-label="Riwayat absensi saya">
                <Table.Head>
                  <Table.Row>
                    <Table.HeadCell>Tanggal</Table.HeadCell>
                    <Table.HeadCell>Status</Table.HeadCell>
                    <Table.HeadCell>Masuk</Table.HeadCell>
                    <Table.HeadCell>Keluar</Table.HeadCell>
                    <Table.HeadCell priority={2} className="text-right">Keterlambatan</Table.HeadCell>
                    <Table.HeadCell priority={3} className="text-right">Durasi Kerja</Table.HeadCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {rows.map((log) => (
                    <Table.Row key={log.id}>
                      <Table.Cell>{formatWorkDate(log)}</Table.Cell>
                      <Table.Cell>
                        <StatusBadge status={log.status} />
                      </Table.Cell>
                      <Table.Cell>
                        <ClockWithSelfie log={log} kind="check-in" timeZone={timeZone} />
                      </Table.Cell>
                      <Table.Cell>
                        <ClockWithSelfie log={log} kind="check-out" timeZone={timeZone} />
                      </Table.Cell>
                      <Table.Cell className="text-right tabular-nums">
                        {log.lateMinutes > 0 ? formatMinutes(log.lateMinutes) : '—'}
                      </Table.Cell>
                      <Table.Cell className="text-right tabular-nums">
                        {log.workMinutes !== null ? formatMinutes(log.workMinutes) : '—'}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/app/riwayat" className="shrink-0" />
          </>
        )}
      </Page.Body>
    </Page>
  );
}
