'use client';

import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { CircleCheck, ClockAlert, LogOut, MapPinOff, TriangleAlert, Users, UserX } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import DonutChart from '@/components/shared/DonutChart';
import EmptyState from '@/components/shared/EmptyState';
import StatTile from '@/components/shared/StatTile';
import StatusBadge from '@/components/shared/StatusBadge';
import type { AttendanceStatus } from '@/lib/constants/statuses';

// Live dashboard (PRD.md A1/US-03, TRD.md §14: "Dashboard polls /api/attendance/today
// every 30s with React Query"). This file owns the whole client boundary — the
// Server Component (app/app/page.tsx) only renders the static header around it.

const POLL_INTERVAL_MS = 30_000;
const DASHBOARD_QUERY_KEY = ['attendance', 'today'] as const;

// Mirrors the GET /api/attendance/today response shape (app/api/attendance/today/route.ts)
// — the wire shape, not lib/queries/attendance.ts's DashboardRow (a server-only type with
// extra fields this view never renders, e.g. branchId).
interface DashboardRow {
  userId: number;
  name: string;
  branchName: string | null;
  status: AttendanceStatus | 'NOT_YET_IN';
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInIsOutside: boolean;
  checkOutIsOutside: boolean;
}

interface DashboardCounts {
  total: number;
  checkedIn: number;
  late: number;
  notYetIn: number;
  outsideArea: number;
  missingCheckOut: number;
}

interface DashboardPayload {
  workDate: string;
  rows: DashboardRow[];
  counts: DashboardCounts;
}

export interface DashboardClientProps {
  /** organizations.timezone (TRD.md §5) — passed down from the Server Component so
   * check-in/out times render in the org's own timezone, not the viewer's browser. */
  orgTimezone: string;
}

async function fetchDashboardToday(): Promise<DashboardPayload> {
  const res = await fetch('/api/attendance/today');
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? 'Gagal memuat data dashboard.');
  }
  return json.data as DashboardPayload;
}

function formatClockTime(value: string | null, timeZone: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('id-ID', { timeZone, hour: '2-digit', minute: '2-digit' });
}

// workDate is a pure "YYYY-MM-DD" calendar date with no time component; formatting it
// with timeZone: 'UTC' keeps it from shifting a day for a viewer behind UTC (same
// technique as components/shared/RequestCard.tsx's DATE_FORMATTER).
const WORK_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

// Statuses that mean "not expected at work today" (approved leave/sick/permit, a holiday).
// They are their own donut slice: counting them as on-time (as `counts.checkedIn` does,
// since it is simply "has a row") would make a person on leave look present.
const AWAY_STATUSES: ReadonlyArray<DashboardRow['status']> = ['LEAVE', 'SICK', 'PERMIT', 'HOLIDAY', 'OFF'];

let browserQueryClient: QueryClient | undefined;

/**
 * Server render gets its own isolated QueryClient; the browser reuses one singleton
 * across re-renders (Next.js's TanStack Query guide). This dashboard is the only
 * /app/* route on React Query so far, so the provider is scoped to this file instead
 * of app/app/layout.tsx.
 */
function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return new QueryClient();
  browserQueryClient ??= new QueryClient();
  return browserQueryClient;
}

export default function DashboardClient({ orgTimezone }: DashboardClientProps) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <DashboardContent orgTimezone={orgTimezone} />
    </QueryClientProvider>
  );
}

function DashboardContent({ orgTimezone }: DashboardClientProps) {
  const { show } = useToast();
  const hasToastedRef = useRef(false);

  const { data, dataUpdatedAt, isLoading, isError, error, refetch } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboardToday,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    // One retry, not the default three (≈7s of skeleton before the error state): on a failed
    // first load the manager should see "Gagal memuat" with its retry button within a couple
    // of seconds. The 30s poll covers anything transient after that.
    retry: 1,
  });

  // Edge-triggered: toast once per failure episode, not on every failed 30s poll. Only while a
  // previous result is still on screen: a failed FIRST load already shows its own message and a
  // "Coba Lagi" button in the page, and a toast saying the same thing on top of the title was noise.
  useEffect(() => {
    if (isError && data) {
      if (!hasToastedRef.current) {
        hasToastedRef.current = true;
        show(error?.message ?? 'Gagal memperbarui data dashboard.', 'error');
      }
    } else {
      hasToastedRef.current = false;
    }
  }, [isError, data, error, show]);

  // First load only — isLoading is isPending && isFetching (TanStack Query v5), which
  // goes false for good after the first successful fetch, so a background 30s refetch
  // never flips this back to true. The table keeps showing last-known data instead.
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <EmptyState
        icon={TriangleAlert}
        message="Gagal memuat data dashboard. Periksa koneksi internet Anda."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Coba Lagi
          </Button>
        }
      />
    );
  }

  const { counts, rows, workDate } = data;
  // Per-status tallies come from the rows themselves, so every slice and tile means exactly
  // what its label says (see AWAY_STATUSES). The API's own counts are still used for the
  // figures that already match their label (total, late, not yet in, outside, no check-out).
  const onTime = rows.filter((row) => row.status === 'PRESENT').length;
  const away = rows.filter((row) => AWAY_STATUSES.includes(row.status)).length;
  const absent = rows.filter((row) => row.status === 'ABSENT').length;
  const updatedAt = new Date(dataUpdatedAt).toLocaleTimeString('id-ID', {
    timeZone: orgTimezone,
    hour: '2-digit',
    minute: '2-digit',
  });

  // Desktop: one viewport tall. The summary row keeps its natural height and the attendance
  // section takes whatever is left, its table scrolling inside (ui/TableFrame) with the column
  // head pinned. Below lg the page just stacks and scrolls as usual.
  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      {/* From md the summary card sits beside a three-column tile grid (a full-width card left
          half of itself empty on a tablet). The card is narrow enough that the ring and its
          legend only fit side by side thanks to DonutChart's container query. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <Card.Header className="flex-wrap">
            <h2 className="text-sm font-semibold text-text">Ringkasan Hari Ini</h2>
            <span className="text-xs text-muted">{WORK_DATE_FORMATTER.format(new Date(workDate))}</span>
          </Card.Header>
          <Card.Body className="flex flex-1 items-center">
            <DonutChart
              size={112}
              ringClassName="size-24 xl:size-28"
              className="w-full"
              centerValue={String(counts.total)}
              centerLabel="Karyawan"
              segments={[
                { label: 'Tepat Waktu', value: onTime, color: 'var(--color-status-present)' },
                { label: 'Terlambat', value: counts.late, color: 'var(--color-status-late)' },
                { label: 'Cuti/Sakit/Izin', value: away, color: 'var(--color-status-leave)' },
                // Gray, not the absent red: before the shift starts everyone is "belum hadir", and a
                // solid red ring all morning read as an alarm (the table chip for the same state is
                // a neutral hollow dot too). Red stays for the Laporan ring, where "Tidak Hadir" is real.
                { label: 'Belum Hadir', value: counts.notYetIn + absent, color: 'var(--color-muted)' },
              ]}
            />
          </Card.Body>
        </Card>

        {/* auto-rows-fr: from md to xl a tile is ~135px wide and "Belum Check‑out" wraps to two
            lines; equal row heights keep the grid even instead of one tall row. */}
        <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 xl:gap-4">
          <StatTile
            label="Total Karyawan"
            value={counts.total}
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Sudah Hadir"
            value={onTime + counts.late}
            icon={<CircleCheck className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Terlambat"
            value={counts.late}
            icon={<ClockAlert className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Belum Hadir"
            value={counts.notYetIn + absent}
            icon={<UserX className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Luar Area"
            value={counts.outsideArea}
            icon={<MapPinOff className="h-4 w-4" aria-hidden="true" />}
          />
          {/* U+2011 non-breaking hyphen: on a phone the label wrapped as "Belum Check-" / "out". */}
          <StatTile
            label="Belum Check‑out"
            value={counts.missingCheckOut}
            icon={<LogOut className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </div>

      {/* lg:min-h-40: on a very short window the row above is kept whole and the table keeps a
          usable few rows, so the page body (not the table) is what scrolls then. */}
      <section className="flex flex-col gap-3 lg:min-h-40 lg:flex-1" aria-labelledby="dashboard-today-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="dashboard-today-heading" className="text-base font-semibold text-text">
            Kehadiran Karyawan
          </h2>
          <p className="text-xs text-muted">Diperbarui {updatedAt} · otomatis setiap 30 detik</p>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} message="Belum ada karyawan yang terjadwal hari ini." />
        ) : (
          <>
            <TodayList rows={rows} timeZone={orgTimezone} />
            <TodayTable rows={rows} timeZone={orgTimezone} />
          </>
        )}
      </section>
    </div>
  );
}

interface TodayRowsProps {
  rows: DashboardRow[];
  timeZone: string;
}

// Phones get one stacked row per person: as a five-column table a 360px screen showed only
// the name and half the status, and the times needed a sideways scroll. From sm up there is
// room for the table (TodayTable), so this list is hidden there.
function TodayList({ rows, timeZone }: TodayRowsProps) {
  return (
    <ul className="divide-y divide-border rounded-card border border-border bg-surface sm:hidden">
      {rows.map((row) => (
        <li key={row.userId} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 break-words text-sm font-medium text-text">{row.name}</p>
              <p className="truncate text-xs text-muted">{row.branchName ?? 'Tanpa cabang'}</p>
            </div>
            <StatusCell status={row.status} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 text-sm tabular-nums">
            <div className="flex items-center gap-1.5">
              <dt className="text-muted">Masuk</dt>
              <dd className="inline-flex items-center gap-1.5 text-text">
                {formatClockTime(row.checkInAt, timeZone)}
                {row.checkInIsOutside ? <OutsideFlag label="Check-in di luar area" /> : null}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted">Keluar</dt>
              <dd className="inline-flex items-center gap-1.5 text-text">
                {formatClockTime(row.checkOutAt, timeZone)}
                {row.checkOutIsOutside ? <OutsideFlag label="Check-out di luar area" /> : null}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function TodayTable({ rows, timeZone }: TodayRowsProps) {
  return (
    // A flex column (not a plain block) so ui/Table's frame can shrink to the height the section
    // has left and scroll its rows inside, on desktop; below lg it just grows with its rows.
    <div className="hidden min-h-0 flex-col sm:flex">
      <Table aria-label="Kehadiran karyawan hari ini">
        <Table.Head>
          <Table.Row>
            {/* Status and times right after the name: these are what a manager checks
                first, and on a tablet they stay in view without scrolling sideways. */}
            <Table.HeadCell>Nama</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell>Jam Masuk</Table.HeadCell>
            <Table.HeadCell>Jam Keluar</Table.HeadCell>
            <Table.HeadCell>Cabang</Table.HeadCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row key={row.userId}>
              <Table.Cell>
                <span className="block max-w-64 truncate" title={row.name}>
                  {row.name}
                </span>
              </Table.Cell>
              <Table.Cell>
                <StatusCell status={row.status} />
              </Table.Cell>
              <Table.Cell className="tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  {formatClockTime(row.checkInAt, timeZone)}
                  {row.checkInIsOutside ? <OutsideFlag label="Check-in di luar area" /> : null}
                </span>
              </Table.Cell>
              <Table.Cell className="tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  {formatClockTime(row.checkOutAt, timeZone)}
                  {row.checkOutIsOutside ? <OutsideFlag label="Check-out di luar area" /> : null}
                </span>
              </Table.Cell>
              <Table.Cell>
                {row.branchName ? (
                  <span className="block max-w-56 truncate" title={row.branchName}>
                    {row.branchName}
                  </span>
                ) : (
                  '—'
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}

// NOT_YET_IN is synthetic — only this dashboard response produces it (COALESCE over a
// left join with no log row yet); it is not in StatusBadge's AttendanceStatus union, so
// it gets its own plain Badge instead of being forced through StatusBadge.
function StatusCell({ status }: { status: AttendanceStatus | 'NOT_YET_IN' }) {
  if (status === 'NOT_YET_IN') {
    // Same chip as StatusBadge (neutral fill, hairline, 8px dot) so a "Belum Hadir" row lines up
    // with its neighbours; the dot is hollow because nothing has happened yet.
    return (
      <Badge className="gap-1.5 border border-border bg-accent text-text">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full border border-muted" />
        Belum Hadir
      </Badge>
    );
  }
  return <StatusBadge status={status} />;
}

// title gives mouse users the same explanation screen readers get from aria-label. amber-700
// (not -600) in light mode: the icon is the only cue in the cell, and -600 is 2.9:1 on the card.
function OutsideFlag({ label }: { label: string }) {
  return (
    <span title={label} className="inline-flex">
      <TriangleAlert className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" role="img" aria-label={label} />
    </span>
  );
}

// Also the dashboard's route-level loading state (app/app/loading.tsx), so the placeholder a person
// sees right after pressing "Dashboard" and the one while the numbers load are the same shape.
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <span role="status" className="sr-only">
        Memuat data dashboard…
      </span>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Same row height as the loaded summary row (the card stretches to the tiles from md up),
            so the table does not jump down when the data arrives. */}
        <Skeleton className="h-44 md:h-auto" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 md:h-24 xl:h-[5.625rem]" />
          ))}
        </div>
      </div>
      <Skeleton className="h-80 w-full lg:h-auto lg:min-h-40 lg:flex-1" />
    </div>
  );
}
