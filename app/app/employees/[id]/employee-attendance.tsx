import Link from 'next/link';
import { CircleCheck, ClockAlert, History, Timer, UserX } from 'lucide-react';
import Table from '@/components/ui/Table';
import StatTile from '@/components/shared/StatTile';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import SelfieLink from '@/components/shared/SelfieLink';
import { listAttendanceForOrg } from '@/lib/queries/attendance';
import type { AttendanceLogRow } from '@/lib/queries/attendance';
import { getMyMonthSummary } from '@/lib/queries/my-attendance';
import { calendarDateToUtc, formatClock, todayInZone } from '@/app/m/format';
import { formatMinutes, toCalendarDate } from '@/app/app/attendance/format';

// The "Kehadiran" half of /app/employees/[id]: this person's month at a glance and their latest rows, so an
// admin sees what a check-in did without leaving the employee's page. It reads the same query the Absensi
// table and /app/riwayat use (listAttendanceForOrg, getMyMonthSummary), so a status here means what it
// means there. `employeeId` has already been checked against the session by the page (same organisation;
// a MANAGER only for a direct report), and both queries filter by `orgId` themselves.

const RECENT_ROWS = 10;
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTH_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function Clock({ log, kind, timeZone }: { log: AttendanceLogRow; kind: 'check-in' | 'check-out'; timeZone: string }) {
  const at = kind === 'check-in' ? log.checkInAt : log.checkOutAt;
  const photo = kind === 'check-in' ? log.checkInPhotoUrl : log.checkOutPhotoUrl;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      {formatClock(at, timeZone)}
      {photo ? <SelfieLink logId={log.id} kind={kind} /> : null}
    </span>
  );
}

export interface EmployeeAttendanceProps {
  orgId: number;
  employeeId: number;
  timeZone: string;
  /** The person has a shift. Without one nobody expects a check-in, so the empty state says so. */
  tracked: boolean;
}

export default async function EmployeeAttendance({ orgId, employeeId, timeZone, tracked }: EmployeeAttendanceProps) {
  const monthStart = `${todayInZone(timeZone).slice(0, 7)}-01`;
  const [{ rows, total }, summary] = await Promise.all([
    listAttendanceForOrg(orgId, { userId: employeeId }, 1, RECENT_ROWS),
    getMyMonthSummary(orgId, employeeId, monthStart),
  ]);
  const monthLabel = MONTH_FORMATTER.format(calendarDateToUtc(monthStart));

  return (
    <>
      <section aria-label={`Kehadiran ${monthLabel}`} className="flex shrink-0 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold capitalize text-text">Kehadiran {monthLabel}</h2>
          {total > 0 ? (
            <Link
              href="/app/attendance"
              className="rounded-input text-sm text-muted underline underline-offset-4 hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Lihat semua di Absensi
            </Link>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 fit-gap lg:grid-cols-4">
          <StatTile
            hideSubOnShort
            label="Hadir"
            value={summary.present + summary.late}
            subLabel={summary.workMinutes > 0 ? `Kerja ${formatMinutes(summary.workMinutes)}` : 'hari hadir'}
            icon={<CircleCheck className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            hideSubOnShort
            label="Terlambat"
            value={summary.late}
            subLabel={summary.lateMinutes > 0 ? `Total ${formatMinutes(summary.lateMinutes)}` : 'hari terlambat'}
            icon={<ClockAlert className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            hideSubOnShort
            label="Tidak hadir"
            value={summary.absent}
            subLabel="hari tanpa kabar"
            icon={<UserX className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            hideSubOnShort
            label="Cuti/Sakit/Izin"
            value={summary.away}
            subLabel="hari disetujui"
            icon={<Timer className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </section>

      {total === 0 ? (
        <EmptyState
          icon={History}
          message={
            tracked
              ? 'Belum ada catatan absensi untuk karyawan ini. Catatan muncul setelah ia check-in.'
              : 'Karyawan ini belum punya shift, jadi tidak ada absensi yang dicatat.'
          }
        />
      ) : (
        <div className="flex flex-col lg:min-h-28 lg:flex-1">
          <Table aria-label="Absensi terbaru karyawan">
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
                  <Table.Cell>{DATE_FORMATTER.format(calendarDateToUtc(toCalendarDate(log.workDate)))}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={log.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <Clock log={log} kind="check-in" timeZone={timeZone} />
                  </Table.Cell>
                  <Table.Cell>
                    <Clock log={log} kind="check-out" timeZone={timeZone} />
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
      )}
    </>
  );
}
