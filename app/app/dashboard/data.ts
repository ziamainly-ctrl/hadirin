import 'server-only';
import { cached, cacheKeys } from '@/lib/redis';
import { ORG_WIDE_ROLES, type UserRole } from '@/lib/constants/roles';
import { getDashboardRows, getHolidayNameForDate, type DashboardRow } from '@/lib/queries/attendance';
import { getCheckInHourCounts } from '@/lib/queries/analytics';
import {
  getDailyOverview,
  getPendingRequestsSummary,
  getSameTimeSnapshot,
  listTodayLate,
  type DashboardScope,
} from '@/lib/queries/dashboard-insights';
import { todayWorkDateFor } from '@/lib/dashboard-cache';
import { addDaysToDateString } from '@/lib/tz';
import {
  branchBreakdown,
  buildDaySeries,
  buildHeatmap,
  buildHourSeries,
  buildKpis,
  outsidePeople,
  recentPunches,
  summarizeToday,
  todayHourCounts,
  trendPoints,
} from './model';
import type { DashboardData, RosterRow } from './model';

// Everything the dashboard shows, in one parallel round: the roster (the SAME `dash:{org}:{date}`
// payload GET /api/attendance/today caches for 20 s and every punch busts, TRD.md section 10), the
// 35-day daily overview, the same-time snapshot behind the KPI deltas, the check-in hours of the
// last two weeks, today's worst late arrivals and the pending approvals. Only the roster is cached;
// the rest are small indexed aggregates that must reflect a punch or an approval the moment the page
// re-renders (AutoRefresh calls router.refresh() every 30 s).

const HISTORY_DAYS = 35; // five ISO weeks for the heatmap, 30 days for the trend
const USUAL_DAYS = 14; // the "biasanya" baseline of the hour chart
const FEED_LIMIT = 8;

interface RosterPayload {
  rows: DashboardRow[];
  holidayName: string | null;
}

/** Instants leave the cache as ISO strings but a fresh query can hand back a Date: normalise both. */
function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function loadRoster(orgId: number, workDate: string, managerId: number | undefined) {
  const payload = await cached<RosterPayload>(cacheKeys.dashboard(orgId, workDate), 20, async () => {
    const [rows, holidayName] = await Promise.all([getDashboardRows(orgId, workDate), getHolidayNameForDate(orgId, workDate)]);
    return { rows, holidayName };
  });
  // The cache holds the unfiltered board; a MANAGER's view is cut from it after the hit.
  const visible = managerId === undefined ? payload.rows : payload.rows.filter((row) => row.managerId === managerId);
  const rows: RosterRow[] = visible.map((row) => ({
    userId: row.userId,
    name: row.name,
    branchId: row.branchId,
    branchName: row.branchName,
    status: row.status,
    checkInAt: toIso(row.checkInAt),
    checkOutAt: toIso(row.checkOutAt),
    checkInIsOutside: Boolean(row.checkInIsOutside),
    checkOutIsOutside: Boolean(row.checkOutIsOutside),
  }));
  return { rows, holidayName: payload.holidayName };
}

export interface LoadDashboardInput {
  orgId: number;
  userId: number;
  role: UserRole;
  timeZone: string;
}

export async function loadDashboard({ orgId, userId, role, timeZone }: LoadDashboardInput): Promise<DashboardData> {
  const orgWide = ORG_WIDE_ROLES.includes(role);
  const scope: DashboardScope = orgWide ? {} : { managerId: userId };
  const today = todayWorkDateFor(timeZone);
  const yesterday = addDaysToDateString(today, -1);

  const [roster, overview, snapshot, hourRows, lateTop, pending] = await Promise.all([
    loadRoster(orgId, today, orgWide ? undefined : userId),
    getDailyOverview(orgId, addDaysToDateString(today, -(HISTORY_DAYS - 1)), yesterday, scope),
    getSameTimeSnapshot(orgId, today, scope),
    getCheckInHourCounts(orgId, addDaysToDateString(today, -USUAL_DAYS), yesterday, timeZone, scope),
    listTodayLate(orgId, today, 3, scope),
    getPendingRequestsSummary(orgId, scope),
  ]);

  const rows = roster.rows;
  const stats = summarizeToday(rows);
  const series = buildDaySeries(overview, today);
  const usualDays = series.filter((d) => d.daysAgo <= USUAL_DAYS).length;

  return {
    today,
    timeZone,
    generatedAt: new Date().toISOString(),
    orgWide,
    holidayName: roster.holidayName,
    stats,
    kpis: buildKpis(stats, series, snapshot, today, {
      hadir: '/app/attendance',
      terlambat: '/app/terlambat',
      belum: '/app/live',
      luar: '/app/luar-area',
      rate: orgWide ? '/app/statistik' : '/app/kalender',
    }),
    trend: trendPoints(series, 30),
    branches: branchBreakdown(rows),
    hours: buildHourSeries(todayHourCounts(rows, timeZone), hourRows, usualDays),
    heatmap: buildHeatmap(series, today, 5),
    feed: recentPunches(rows, FEED_LIMIT),
    attention: {
      late: { count: stats.late, top: lateTop.map((r) => ({ userId: r.userId, name: r.name, lateMinutes: r.lateMinutes })) },
      outside: { count: stats.outside, names: outsidePeople(rows, 3) },
      pending,
    },
    empty: rows.length === 0 && series.length === 0,
  };
}
