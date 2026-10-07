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
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboardToday,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  // Edge-triggered: toast once per failure episode, not on every failed 30s poll.
  useEffect(() => {
    if (isError) {
      if (!hasToastedRef.current) {
        hasToastedRef.current = true;
        show(error?.message ?? 'Gagal memperbarui data dashboard.', 'error');
      }
    } else {
      hasToastedRef.current = false;
    }
  }, [isError, error, show]);

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
          <Button variant="secondary" onClick={() => refetch()}>
            Coba lagi
          </Button>
        }
      />
    );
  }

  const { counts, rows, workDate } = data;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Data {WORK_DATE_FORMATTER.format(new Date(workDate))} · diperbarui otomatis setiap 30 detik
      </p>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card shadow>
          <Card.Header>
            <h2 className="text-sm font-semibold text-text">Ringkasan Hari Ini</h2>
          </Card.Header>
          <Card.Body>
            <DonutChart
              centerValue={String(counts.total)}
              centerLabel="Karyawan"
              segments={[
                { label: 'Tepat Waktu', value: Math.max(0, counts.checkedIn - counts.late), color: 'var(--color-status-present)' },
                { label: 'Terlambat', value: counts.late, color: 'var(--color-status-late)' },
                { label: 'Belum Hadir', value: counts.notYetIn, color: 'var(--color-status-absent)' },
              ]}
            />
          </Card.Body>
        </Card>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile
            label="Total Karyawan"
            value={counts.total}
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Sudah Hadir"
            value={counts.checkedIn}
            icon={<CircleCheck className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Terlambat"
            value={counts.late}
            icon={<ClockAlert className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Belum Hadir"
            value={counts.notYetIn}
            icon={<UserX className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Luar Area"
            value={counts.outsideArea}
            icon={<MapPinOff className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Belum Check-out"
            value={counts.missingCheckOut}
            icon={<LogOut className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} message="Belum ada karyawan yang terjadwal hari ini." />
      ) : (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Nama</Table.HeadCell>
              <Table.HeadCell>Cabang</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Jam Masuk</Table.HeadCell>
              <Table.HeadCell>Jam Keluar</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row key={row.userId}>
                <Table.Cell>{row.name}</Table.Cell>
                <Table.Cell>{row.branchName ?? '—'}</Table.Cell>
                <Table.Cell>
                  <StatusCell status={row.status} />
                </Table.Cell>
                <Table.Cell>
                  <span className="inline-flex items-center gap-1.5">
                    {formatClockTime(row.checkInAt, orgTimezone)}
                    {row.checkInIsOutside ? <OutsideFlag label="Check-in di luar area" /> : null}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="inline-flex items-center gap-1.5">
                    {formatClockTime(row.checkOutAt, orgTimezone)}
                    {row.checkOutIsOutside ? <OutsideFlag label="Check-out di luar area" /> : null}
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}

// NOT_YET_IN is synthetic — only this dashboard response produces it (COALESCE over a
// left join with no log row yet); it is not in StatusBadge's AttendanceStatus union, so
// it gets its own plain Badge instead of being forced through StatusBadge.
function StatusCell({ status }: { status: AttendanceStatus | 'NOT_YET_IN' }) {
  if (status === 'NOT_YET_IN') {
    return <Badge className="bg-accent text-muted">Belum Masuk</Badge>;
  }
  return <StatusBadge status={status} />;
}

function OutsideFlag({ label }: { label: string }) {
  return <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" role="img" aria-label={label} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Memuat data dashboard…
      </span>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Skeleton className="h-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
