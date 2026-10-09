import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Camera, ListChecks, TriangleAlert } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listAttendanceForOrg } from '@/lib/queries/attendance';
import { listUsers, getUserByIdInOrg } from '@/lib/queries/users';
import { listBranches } from '@/lib/queries/branches';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { dateStringSchema, idParam } from '@/lib/validators/common';
import { ATTENDANCE_STATUSES } from '@/lib/constants/statuses';
import type { AttendanceStatus } from '@/lib/constants/statuses';
import Table from '@/components/ui/Table';
import type { TableProps } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import AttendanceFilters from './filters';
import { formatMinutes, toCalendarDate } from './format';

export const metadata: Metadata = { title: 'Absensi' };

// One server chunk; the client fit pager (components/shared/FitPager) splits it into screen-sized pages.
const PAGE_SIZE = 100;

interface AttendancePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateParam(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const result = dateStringSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function parseIdParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const result = idParam.safeParse(value);
  return result.success ? result.data : undefined;
}

function parseStatusParam(value: string | undefined): AttendanceStatus | undefined {
  return value && (ATTENDANCE_STATUSES as readonly string[]).includes(value) ? (value as AttendanceStatus) : undefined;
}

// Pure calendar date (no time component): toCalendarDate() first turns the driver's Date
// back into "YYYY-MM-DD", then timeZone: 'UTC' formats that midnight without shifting it a
// day under any offset — same convention as components/shared/RequestCard.tsx.
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

// HH:MM in the org's own timezone (organizations.timezone, TRD.md §5) — the same zone the
// dashboard uses, so a WITA/WIT org never sees its check-ins an hour off here.
function formatTime(value: string | null, timeZone: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('id-ID', { timeZone, hour: '2-digit', minute: '2-digit' });
}

/**
 * Admin attendance table (PRD.md, TRD.md §6 `GET /api/attendance`). Server Component:
 * calls lib/queries/attendance + lib/queries/users + lib/queries/branches directly
 * (TRD.md §5), never a self-fetch over /api/*. Role scoping mirrors
 * app/api/attendance/route.ts's GET handler verbatim — this page has no userId search
 * param of its own, so the API's `query.userId` branch is always undefined here:
 * ADMIN+ see everything, MANAGER is scoped to their team via managerId, EMPLOYEE sees
 * only their own. Filtering (date range, branch) is wired through ./filters.tsx
 * (client) so this page needs no "use client" of its own.
 */
export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const { userId, orgId, role } = await requireSession();
  const params = await searchParams;

  const dateFrom = parseDateParam(firstValue(params.dateFrom));
  const dateTo = parseDateParam(firstValue(params.dateTo));
  const branchId = parseIdParam(firstValue(params.branchId));
  const status = parseStatusParam(firstValue(params.status));
  const page = Math.max(1, Number(firstValue(params.page)) || 1);

  const isOrgWide = role === 'OWNER' || role === 'ADMIN';

  // Name lookup is scoped the same way as the attendance rows themselves (same
  // pattern as app/app/requests/page.tsx) rather than fetching the whole org roster.
  const namesPromise: Promise<Map<number, string>> = isOrgWide
    ? listUsers(orgId, {}).then((users) => new Map(users.map((u) => [u.id, u.name] as const)))
    : role === 'MANAGER'
      ? listUsers(orgId, { managerId: userId }).then((users) => new Map(users.map((u) => [u.id, u.name] as const)))
      : getUserByIdInOrg(orgId, userId).then((me) => new Map([[me.id, me.name] as const]));

  const [{ rows, total }, branches, nameByUserId, org] = await Promise.all([
    listAttendanceForOrg(
      orgId,
      {
        dateFrom,
        dateTo,
        branchId,
        status,
        userId: isOrgWide ? undefined : role === 'MANAGER' ? undefined : userId,
        managerId: role === 'MANAGER' ? userId : undefined,
      },
      page,
      PAGE_SIZE,
    ),
    listBranches(orgId, { activeOnly: true }),
    namesPromise,
    getOrganizationPlanContext(orgId),
  ]);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const hasFilter = Boolean(dateFrom || dateTo || branchId !== undefined || status);

  const branchOptions = branches.map((b) => ({ id: b.id, name: b.name }));
  const filterSearchParams = {
    dateFrom,
    dateTo,
    branchId: branchId !== undefined ? String(branchId) : undefined,
    status,
  };

  // A page number past the end (a stale bookmark, or the data shrank under a filter) used to
  // render an empty table under a pager that said "Halaman 1 dari 1". Send it to the last real page.
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > lastPage) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filterSearchParams)) if (value) query.set(key, value);
    if (lastPage > 1) query.set('page', String(lastPage));
    const queryString = query.toString();
    redirect(queryString ? `/app/attendance?${queryString}` : '/app/attendance');
  }

  // Desktop: header and filters stay put; the table scrolls inside its own box with the column
  // head pinned (ui/TableFrame) and the pager pinned under it. Below lg the page just scrolls.
  return (
    <Page>
      <Page.Header
        title="Absensi"
        description="Riwayat check-in dan check-out karyawan, lengkap dengan foto dan lokasi."
      />

      <AttendanceFilters branches={branchOptions} />

      <Page.Body>
        {total === 0 ? (
          hasFilter ? (
            // No action button here: "Hapus Filter" already sits right above, in the filter bar.
            <EmptyState
              icon={ListChecks}
              message="Tidak ada data absensi yang cocok dengan filter ini. Coba ubah atau hapus filter."
            />
          ) : (
            <EmptyState
              icon={ListChecks}
              message="Belum ada data absensi. Data muncul setelah karyawan melakukan check-in."
            />
          )
        ) : (
          <>
            <AttendanceList rows={rows} names={nameByUserId} timeZone={timeZone} />
            <AttendanceTable
              rows={rows}
              names={nameByUserId}
              timeZone={timeZone}
              serverPager={{ page, pageSize: PAGE_SIZE, total, basePath: '/app/attendance', searchParams: filterSearchParams }}
            />
            {/* Desktop pages through the table's own footer (ui/TableFrame serverPager); this plain
                pager is for the phone list and the short window where the table does not paginate. */}
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              basePath="/app/attendance"
              searchParams={filterSearchParams}
              className="fit-hide-desktop shrink-0"
            />
          </>
        )}
      </Page.Body>
    </Page>
  );
}

type AttendanceRow = Awaited<ReturnType<typeof listAttendanceForOrg>>['rows'][number];

interface AttendanceRowsProps {
  rows: AttendanceRow[];
  names: Map<number, string>;
  timeZone: string;
}

function formatWorkDate(log: AttendanceRow): string {
  return DATE_FORMATTER.format(new Date(toCalendarDate(log.workDate)));
}

// Selfie link next to a check-in/out time: a padded hit area (the bare 16px icon was too
// small to tap; 40px on a touch screen, with the negative margin keeping the row height) with a
// visible focus ring, since it is the only control in the row.
function SelfieLink({ logId, kind }: { logId: number; kind: 'check-in' | 'check-out' }) {
  const label = `Lihat foto ${kind}`;
  return (
    <a
      href={`/api/files/attendance-logs/${logId}/${kind}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="-m-1.5 inline-flex rounded-input p-1.5 pointer-coarse:-m-3 pointer-coarse:p-3 text-muted transition-colors hover:bg-accent hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Camera className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

function ClockWithSelfie({ log, kind, timeZone }: { log: AttendanceRow; kind: 'check-in' | 'check-out'; timeZone: string }) {
  const at = kind === 'check-in' ? log.checkInAt : log.checkOutAt;
  const photo = kind === 'check-in' ? log.checkInPhotoUrl : log.checkOutPhotoUrl;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      {formatTime(at, timeZone)}
      {photo ? <SelfieLink logId={log.id} kind={kind} /> : null}
    </span>
  );
}

// Spelled out, not a lone icon: an empty cell could mean "inside" or "no check-in", and
// the warning icon alone had no visible meaning.
function LocationLabel({ log }: { log: AttendanceRow }) {
  if (log.checkInIsOutside || log.checkOutIsOutside) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        Luar area
      </span>
    );
  }
  return <span className="text-muted">{log.checkInAt ? 'Dalam area' : '—'}</span>;
}

// Phones get one stacked row per log: as an eight-column table a 360px screen showed the
// name and date only, and the status, times and selfies were all off to the right. From sm
// up the table (AttendanceTable) has the room, so this list is hidden there.
function AttendanceList({ rows, names, timeZone }: AttendanceRowsProps) {
  return (
    <ul className="divide-y divide-border rounded-card border border-border bg-surface sm:hidden">
      {rows.map((log) => {
        // Only what is worth a glance: lateness, worked time and an outside-area flag. "Dalam
        // area" is the normal case, so on a phone it is left out instead of filling every row.
        const isOutside = log.checkInIsOutside || log.checkOutIsOutside;
        const extras = [
          log.lateMinutes > 0 ? `Terlambat ${formatMinutes(log.lateMinutes)}` : null,
          log.workMinutes !== null ? `Kerja ${formatMinutes(log.workMinutes)}` : null,
        ].filter((item): item is string => item !== null);
        return (
          <li key={log.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 break-words font-medium text-text">{names.get(log.userId) ?? `#${log.userId}`}</p>
                <p className="text-xs text-muted">{formatWorkDate(log)}</p>
              </div>
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
            {extras.length > 0 || isOutside ? (
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                {extras.length > 0 ? <span className="tabular-nums">{extras.join(' · ')}</span> : null}
                {extras.length > 0 && isOutside ? <span aria-hidden="true">·</span> : null}
                {isOutside ? <LocationLabel log={log} /> : null}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function AttendanceTable({ rows, names, timeZone, serverPager }: AttendanceRowsProps & { serverPager: TableProps['serverPager'] }) {
  return (
    // A flex column so ui/Table's frame can shrink to the space Page.Body has left and scroll its
    // rows inside (header pinned); the pager below stays in view.
    <div className="hidden min-h-0 flex-col sm:flex">
      <Table aria-label="Riwayat absensi karyawan" serverPager={serverPager}>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Karyawan</Table.HeadCell>
            <Table.HeadCell>Tanggal</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell>Masuk</Table.HeadCell>
            <Table.HeadCell>Keluar</Table.HeadCell>
            <Table.HeadCell priority={1} className="text-right">Keterlambatan</Table.HeadCell>
            <Table.HeadCell priority={3} className="text-right">Durasi Kerja</Table.HeadCell>
            <Table.HeadCell priority={2}>Lokasi</Table.HeadCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map((log) => (
            <Table.Row key={log.id}>
              <Table.Cell>
                <span className="block max-w-56 truncate" title={names.get(log.userId)}>
                  {names.get(log.userId) ?? `#${log.userId}`}
                </span>
              </Table.Cell>
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
              <Table.Cell>
                <LocationLabel log={log} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
