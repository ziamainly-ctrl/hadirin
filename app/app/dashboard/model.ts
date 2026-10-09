// Pure aggregation behind the admin dashboard (/app). The queries (lib/queries/dashboard-insights.ts,
// attendance.ts getDashboardRows, analytics.ts) only fetch rows; every count, ratio, delta, series
// and grid is built here so it can be unit-tested (tests/dashboard-model.test.ts) and so the
// components stay presentational. Nothing in this file touches the database, the clock or React.

import type { AttendanceStatus } from '@/lib/constants/statuses';
import type { DailyOverviewRow, SameTimeSnapshot } from '@/lib/queries/dashboard-insights';
import { WEEKDAY_SHORT, formatShortDate, isoWeekday } from '@/lib/insights/calendar-grid';
import { addDaysToDateString, getLocalParts } from '@/lib/tz';

/** One person of today's roster (the wire shape of lib/queries/attendance.ts DashboardRow, minus managerId). */
export interface RosterRow {
  userId: number;
  name: string;
  branchId: number | null;
  branchName: string | null;
  status: AttendanceStatus | 'NOT_YET_IN';
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInIsOutside: boolean;
  checkOutIsOutside: boolean;
}

/** Statuses that mean "not expected at work today" (approved leave, sick, permit, holiday, day off). */
const AWAY_STATUSES: ReadonlySet<string> = new Set(['LEAVE', 'SICK', 'PERMIT', 'HOLIDAY', 'OFF']);

/** The rate (0..100, one decimal) of `part` in `whole`, or null when there is no whole. */
export function ratePercent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

// ---------------------------------------------------------------------------------------------
// Today, from the roster
// ---------------------------------------------------------------------------------------------
export interface TodayStats {
  /** Everyone on today's board. */
  total: number;
  /** Checked in: on time + late. */
  hadir: number;
  onTime: number;
  late: number;
  /** Still expected: not yet in + already marked absent. */
  belum: number;
  /** Approved leave / sick / permit / holiday / off. */
  away: number;
  /** Anyone flagged outside the geofence on check-in or check-out. */
  outside: number;
  /** Checked in and not out yet. */
  openNow: number;
  /** Who was expected today: hadir + belum. */
  expected: number;
  /** Attendance rate so far today (hadir / expected), percent; null when nobody is expected. */
  rate: number | null;
}

export function summarizeToday(rows: readonly RosterRow[]): TodayStats {
  let onTime = 0;
  let late = 0;
  let belum = 0;
  let away = 0;
  let outside = 0;
  let openNow = 0;
  for (const row of rows) {
    if (row.status === 'PRESENT') onTime += 1;
    else if (row.status === 'LATE') late += 1;
    else if (row.status === 'NOT_YET_IN' || row.status === 'ABSENT') belum += 1;
    else if (AWAY_STATUSES.has(row.status)) away += 1;
    if (row.checkInIsOutside || row.checkOutIsOutside) outside += 1;
    if (row.checkInAt && !row.checkOutAt) openNow += 1;
  }
  const hadir = onTime + late;
  const expected = hadir + belum;
  return { total: rows.length, hadir, onTime, late, belum, away, outside, openNow, expected, rate: ratePercent(hadir, expected) };
}

export interface BranchBar {
  id: string;
  name: string;
  onTime: number;
  late: number;
  belum: number;
  away: number;
  total: number;
}

/** Today's roster per home branch (the branch on the employee, as the board's "Cabang" column), biggest first. */
export function branchBreakdown(rows: readonly RosterRow[]): BranchBar[] {
  const map = new Map<string, BranchBar>();
  for (const row of rows) {
    const id = row.branchId === null ? 'none' : String(row.branchId);
    let bar = map.get(id);
    if (!bar) {
      bar = { id, name: row.branchName ?? 'Tanpa cabang', onTime: 0, late: 0, belum: 0, away: 0, total: 0 };
      map.set(id, bar);
    }
    if (row.status === 'PRESENT') bar.onTime += 1;
    else if (row.status === 'LATE') bar.late += 1;
    else if (row.status === 'NOT_YET_IN' || row.status === 'ABSENT') bar.belum += 1;
    else if (AWAY_STATUSES.has(row.status)) bar.away += 1;
    bar.total += 1;
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'id'));
}

export interface PunchItem {
  id: string;
  userId: number;
  name: string;
  kind: 'IN' | 'OUT';
  /** The instant (ISO). */
  at: string;
  branchName: string | null;
  late: boolean;
  outside: boolean;
}

/** The latest check-ins and check-outs of the board, newest first (two events per person at most). */
export function recentPunches(rows: readonly RosterRow[], limit: number): PunchItem[] {
  const items: PunchItem[] = [];
  for (const row of rows) {
    if (row.checkInAt) {
      items.push({
        id: `${row.userId}-in`,
        userId: row.userId,
        name: row.name,
        kind: 'IN',
        at: row.checkInAt,
        branchName: row.branchName,
        late: row.status === 'LATE',
        outside: row.checkInIsOutside,
      });
    }
    if (row.checkOutAt) {
      items.push({
        id: `${row.userId}-out`,
        userId: row.userId,
        name: row.name,
        kind: 'OUT',
        at: row.checkOutAt,
        branchName: row.branchName,
        late: false,
        outside: row.checkOutIsOutside,
      });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at) || a.userId - b.userId).slice(0, limit);
}

/** Today's check-ins per local hour of the organization's clock. */
export function todayHourCounts(rows: readonly RosterRow[], timeZone: string): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (!row.checkInAt) continue;
    const hour = getLocalParts(new Date(row.checkInAt), timeZone).hour;
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------------------------
// History, from the daily overview
// ---------------------------------------------------------------------------------------------
export interface DaySummary {
  date: string;
  /** Calendar days before today (1 = yesterday). */
  daysAgo: number;
  hadir: number;
  late: number;
  absent: number;
  outside: number;
  attended: number;
  obligated: number;
  /** Percent 0..100, one decimal. */
  rate: number;
}

/** Whole calendar days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
  const f = from.split('-').map(Number) as [number, number, number];
  const t = to.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(f[0], f[1] - 1, f[2])) / 86_400_000);
}

/**
 * The working days that are already over, oldest first. A day with nobody expected (weekend, holiday,
 * nothing recorded: on time + late + absent = 0) is dropped, so a weekend never reads as a collapse.
 * Today is never in the series: its figures come from the live roster, and a half-finished day would
 * always look like a dip.
 */
export function buildDaySeries(overview: readonly DailyOverviewRow[], today: string): DaySummary[] {
  const out: DaySummary[] = [];
  for (const d of overview) {
    if (d.date >= today) continue;
    const attended = d.present + d.late;
    const obligated = attended + d.absent;
    if (obligated === 0) continue;
    out.push({
      date: d.date,
      daysAgo: daysBetween(d.date, today),
      hadir: attended,
      late: d.late,
      absent: d.absent,
      outside: d.outside,
      attended,
      obligated,
      rate: ratePercent(attended, obligated) ?? 0,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface TrendPointModel {
  id: string;
  label: string;
  weekday: string;
  value: number;
  attended: number;
  obligated: number;
  daysAgo: number;
}

export function trendPoints(series: readonly DaySummary[], maxDaysAgo: number): TrendPointModel[] {
  return series
    .filter((d) => d.daysAgo <= maxDaysAgo)
    .map((d) => ({
      id: d.date,
      label: formatShortDate(d.date),
      weekday: WEEKDAY_SHORT[isoWeekday(d.date) - 1]!,
      value: d.rate,
      attended: d.attended,
      obligated: d.obligated,
      daysAgo: d.daysAgo,
    }));
}

/** Mean attendance rate over a set of days (weighted by people expected); null when there are none. */
export function averageRate(points: readonly Pick<TrendPointModel, 'attended' | 'obligated'>[]): number | null {
  const attended = points.reduce((sum, p) => sum + p.attended, 0);
  const obligated = points.reduce((sum, p) => sum + p.obligated, 0);
  return ratePercent(attended, obligated);
}

// ---------------------------------------------------------------------------------------------
// KPI strip: value, sparkline, delta against the same time on the last working day
// ---------------------------------------------------------------------------------------------
export type KpiId = 'hadir' | 'terlambat' | 'belum' | 'luar' | 'rate';

export interface KpiDelta {
  /** Signed change: a count, or percentage points for the rate. */
  diff: number;
  direction: 'up' | 'down' | 'flat';
  /** Whether that direction is good news ('flat' is neutral). Colour goes on the arrow only. */
  tone: 'good' | 'bad' | 'neutral';
}

export interface KpiModel {
  id: KpiId;
  label: string;
  value: number | null;
  format: 'int' | 'pct';
  href: string;
  /** The last completed working days, oldest first. */
  spark: number[];
  delta: KpiDelta | null;
}

export interface KpiSet {
  items: KpiModel[];
  /** What the deltas compare with: "kemarin", "Jum" ... (the last working day), null when there is none. */
  refLabel: string | null;
}

function makeDelta(diff: number, upIsGood: boolean): KpiDelta {
  const rounded = Math.round(diff * 10) / 10;
  if (rounded === 0) return { diff: 0, direction: 'flat', tone: 'neutral' };
  const up = rounded > 0;
  return { diff: rounded, direction: up ? 'up' : 'down', tone: up === upIsGood ? 'good' : 'bad' };
}

/** "kemarin" for yesterday, else the short weekday of the working day compared with ("Jum"). */
export function referenceLabel(snapshotDate: string | null, today: string): string | null {
  if (!snapshotDate) return null;
  if (snapshotDate === addDaysToDateString(today, -1)) return 'kemarin';
  return WEEKDAY_SHORT[isoWeekday(snapshotDate) - 1]!;
}

export function buildKpis(
  stats: TodayStats,
  series: readonly DaySummary[],
  snapshot: SameTimeSnapshot,
  today: string,
  links: { hadir: string; terlambat: string; belum: string; luar: string; rate: string },
): KpiSet {
  const recent = series.slice(-7);
  const hasRef = snapshot.date !== null && snapshot.expected > 0;
  const refRate = hasRef ? ratePercent(snapshot.attended, snapshot.expected) : null;
  const refBelum = snapshot.expected - snapshot.attended;
  return {
    refLabel: hasRef ? referenceLabel(snapshot.date, today) : null,
    items: [
      {
        id: 'hadir',
        label: 'Hadir',
        value: stats.hadir,
        format: 'int',
        href: links.hadir,
        spark: recent.map((d) => d.hadir),
        delta: hasRef ? makeDelta(stats.hadir - snapshot.attended, true) : null,
      },
      {
        id: 'terlambat',
        label: 'Terlambat',
        value: stats.late,
        format: 'int',
        href: links.terlambat,
        spark: recent.map((d) => d.late),
        delta: hasRef ? makeDelta(stats.late - snapshot.late, false) : null,
      },
      {
        id: 'belum',
        label: 'Belum Hadir',
        value: stats.belum,
        format: 'int',
        href: links.belum,
        spark: recent.map((d) => d.absent),
        delta: hasRef ? makeDelta(stats.belum - refBelum, false) : null,
      },
      {
        id: 'luar',
        label: 'Di Luar Area',
        value: stats.outside,
        format: 'int',
        href: links.luar,
        spark: recent.map((d) => d.outside),
        delta: hasRef ? makeDelta(stats.outside - snapshot.outside, false) : null,
      },
      {
        id: 'rate',
        label: 'Kehadiran',
        value: stats.rate,
        format: 'pct',
        href: links.rate,
        spark: recent.map((d) => d.rate),
        delta: hasRef && stats.rate !== null && refRate !== null ? makeDelta(stats.rate - refRate, true) : null,
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Check-in hour histogram: today against the usual day
// ---------------------------------------------------------------------------------------------
export interface HourBar {
  hour: number;
  today: number;
  /** Average check-ins in that hour on a usual working day, one decimal. */
  usual: number;
}

export interface HourSeries {
  bars: HourBar[];
  totalToday: number;
  /** The hour with the most check-ins today; null before the first one. */
  peakHour: number | null;
  /** How many working days the "usual" figure is averaged over (0 = no baseline). */
  usualDays: number;
}

const MIN_HOUR_SPAN = 6;

export function buildHourSeries(
  today: ReadonlyMap<number, number>,
  usualTotals: readonly { hour: number; count: number }[],
  usualDays: number,
): HourSeries {
  const todayCounts = new Array<number>(24).fill(0);
  for (const [hour, count] of today) if (hour >= 0 && hour <= 23) todayCounts[hour] = count;
  const usual = new Array<number>(24).fill(0);
  if (usualDays > 0) {
    for (const row of usualTotals) {
      if (Number.isInteger(row.hour) && row.hour >= 0 && row.hour <= 23) usual[row.hour] = Math.round((row.count / usualDays) * 10) / 10;
    }
  }
  const totalToday = todayCounts.reduce((sum, c) => sum + c, 0);
  const active = todayCounts.map((c, h) => (c > 0 || usual[h]! >= 0.5 ? h : -1)).filter((h) => h >= 0);
  if (active.length === 0) return { bars: [], totalToday, peakHour: null, usualDays };

  let from = Math.max(0, active[0]! - 1);
  let to = Math.min(23, active[active.length - 1]! + 1);
  while (to - from + 1 < MIN_HOUR_SPAN) {
    if (to < 23) to += 1;
    else if (from > 0) from -= 1;
    else break;
  }
  let peakHour: number | null = null;
  let peak = 0;
  const bars: HourBar[] = [];
  for (let hour = from; hour <= to; hour += 1) {
    bars.push({ hour, today: todayCounts[hour]!, usual: usual[hour]! });
    if (todayCounts[hour]! > peak) {
      peak = todayCounts[hour]!;
      peakHour = hour;
    }
  }
  return { bars, totalToday, peakHour, usualDays };
}

// ---------------------------------------------------------------------------------------------
// Weekday x week heatmap of the attendance rate
// ---------------------------------------------------------------------------------------------
export interface HeatCell {
  date: string;
  label: string;
  /** Column (week) and row (weekday) indexes inside the grid. */
  week: number;
  row: number;
  /** Percent 0..100, null for a day with nobody expected, today and the future. */
  rate: number | null;
  attended: number;
  obligated: number;
  state: 'data' | 'empty' | 'today' | 'future';
}

export interface HeatmapModel {
  weeks: { start: string; label: string }[];
  rows: { dow: number; label: string }[];
  cells: HeatCell[];
  /** True when at least one day has data (otherwise the card shows its empty note). */
  hasData: boolean;
}

/** Monday of the ISO week of `date`. */
export function weekStartOf(date: string): string {
  return addDaysToDateString(date, -(isoWeekday(date) - 1));
}

/**
 * The last `weekCount` ISO weeks (the current one last) as a weekday x week grid. Monday to Friday
 * are always rows; Saturday and Sunday appear only when some day of that weekday had people expected.
 */
export function buildHeatmap(series: readonly DaySummary[], today: string, weekCount = 5): HeatmapModel {
  const byDate = new Map(series.map((d) => [d.date, d]));
  const currentStart = weekStartOf(today);
  const weeks = Array.from({ length: weekCount }, (_, i) => {
    const start = addDaysToDateString(currentStart, -7 * (weekCount - 1 - i));
    return { start, label: formatShortDate(start) };
  });
  const dows = [1, 2, 3, 4, 5];
  for (const extra of [6, 7]) {
    if (weeks.some((w) => byDate.has(addDaysToDateString(w.start, extra - 1)))) dows.push(extra);
  }
  const cells: HeatCell[] = [];
  weeks.forEach((week, wi) => {
    dows.forEach((dow, ri) => {
      const date = addDaysToDateString(week.start, dow - 1);
      const d = byDate.get(date);
      const state: HeatCell['state'] = date > today ? 'future' : date === today ? 'today' : d ? 'data' : 'empty';
      cells.push({
        date,
        label: formatShortDate(date),
        week: wi,
        row: ri,
        rate: d ? d.rate : null,
        attended: d?.attended ?? 0,
        obligated: d?.obligated ?? 0,
        state,
      });
    });
  });
  return {
    weeks,
    rows: dows.map((dow) => ({ dow, label: WEEKDAY_SHORT[dow - 1]! })),
    cells,
    hasData: cells.some((c) => c.state === 'data'),
  };
}

/** Heat level 1..5 for an attendance rate: darker = more people showed up. */
export function heatLevel(rate: number): 1 | 2 | 3 | 4 | 5 {
  if (rate >= 98) return 5;
  if (rate >= 94) return 4;
  if (rate >= 88) return 3;
  if (rate >= 78) return 2;
  return 1;
}

// ---------------------------------------------------------------------------------------------
// Formatting shared by the cards
// ---------------------------------------------------------------------------------------------
const NUMBER_ID = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

/** "+2", "-1", "0" (a real minus sign would break copy and paste into a spreadsheet, so a hyphen). */
export function formatSigned(value: number): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '-'}${NUMBER_ID.format(Math.abs(value))}`;
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${NUMBER_ID.format(value)}%`;
}

export function formatNumber(value: number): string {
  return NUMBER_ID.format(value);
}

/** 35 -> "35 mnt", 65 -> "1 j 5 mnt", 120 -> "2 j". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} j` : `${h} j ${rest} mnt`;
}

/** Up to `limit` people flagged outside the geofence today, the latest check-in first. */
export function outsidePeople(rows: readonly RosterRow[], limit: number): string[] {
  return rows
    .filter((r) => r.checkInIsOutside || r.checkOutIsOutside)
    .sort((a, b) => (b.checkInAt ?? '').localeCompare(a.checkInAt ?? '') || a.userId - b.userId)
    .slice(0, limit)
    .map((r) => r.name);
}

// ---------------------------------------------------------------------------------------------
// Everything the page hands to the cards (plain data: it crosses the server/client boundary)
// ---------------------------------------------------------------------------------------------
export interface AttentionData {
  late: { count: number; top: { userId: number; name: string; lateMinutes: number }[] };
  outside: { count: number; names: string[] };
  pending: { count: number; oldestDays: number | null };
}

export interface DashboardData {
  /** The organization's calendar date today. */
  today: string;
  timeZone: string;
  /** When the server built this (ISO), for the "Diperbarui" stamp. */
  generatedAt: string;
  /** OWNER / ADMIN see the whole org; a MANAGER sees direct reports only. */
  orgWide: boolean;
  holidayName: string | null;
  stats: TodayStats;
  kpis: KpiSet;
  /** Completed working days of the last 30 calendar days, oldest first. */
  trend: TrendPointModel[];
  branches: BranchBar[];
  hours: HourSeries;
  heatmap: HeatmapModel;
  feed: PunchItem[];
  attention: AttentionData;
  /** Nobody on the board today and no working day on record: show "Mulai di sini" instead of charts. */
  empty: boolean;
}

// ---------------------------------------------------------------------------------------------
// "Perlu perhatian": what an admin should act on, most pressing first
// ---------------------------------------------------------------------------------------------
export type AttentionId = 'pending' | 'late' | 'outside';

export interface AttentionRow {
  id: AttentionId;
  href: string;
  count: number;
  title: string;
  /** Who / how long: a second line shown when the card is tall enough. */
  sub: string | null;
}

function joinNames(names: readonly string[], total: number): string {
  const more = total - names.length;
  return `${names.join(', ')}${more > 0 ? ` +${more} lagi` : ''}`;
}

/**
 * The three things worth a click: requests waiting, people late, people outside the geofence. Rows
 * with something to act on come first (in that priority order); rows at zero follow, quiet. An empty
 * list means everything is clear, and the card says so instead of listing three zeros.
 */
export function buildAttentionRows(data: AttentionData): AttentionRow[] {
  const rows: AttentionRow[] = [
    {
      id: 'pending',
      href: '/app/requests',
      count: data.pending.count,
      title: data.pending.count > 0 ? `${formatNumber(data.pending.count)} permintaan menunggu` : 'Tidak ada permintaan menunggu',
      sub:
        data.pending.count > 0 && data.pending.oldestDays !== null
          ? data.pending.oldestDays === 0
            ? 'Yang tertua masuk hari ini'
            : `Yang tertua ${data.pending.oldestDays} hari lalu`
          : null,
    },
    {
      id: 'late',
      href: '/app/terlambat',
      count: data.late.count,
      title: data.late.count > 0 ? `${formatNumber(data.late.count)} terlambat` : 'Tidak ada yang terlambat',
      sub:
        data.late.count > 0
          ? joinNames(
              data.late.top.map((p) => `${p.name} ${formatMinutes(p.lateMinutes)}`),
              data.late.count,
            )
          : null,
    },
    {
      id: 'outside',
      href: '/app/luar-area',
      count: data.outside.count,
      title: data.outside.count > 0 ? `${formatNumber(data.outside.count)} di luar area` : 'Tidak ada yang di luar area',
      sub: data.outside.count > 0 ? joinNames(data.outside.names, data.outside.count) : null,
    },
  ];
  if (rows.every((r) => r.count === 0)) return [];
  return [...rows.filter((r) => r.count > 0), ...rows.filter((r) => r.count === 0)];
}

// ---------------------------------------------------------------------------------------------
// "Mulai di sini": the setup steps of an organization with nothing to show yet
// ---------------------------------------------------------------------------------------------
export interface SetupStep {
  id: 'branch' | 'shift' | 'people' | 'checkin';
  title: string;
  hint: string;
  href: string;
  done: boolean;
}

export function buildSetupSteps(progress: {
  branches: number;
  shifts: number;
  trackedPeople: number;
  hasOwnCheckIn: boolean;
}): SetupStep[] {
  return [
    { id: 'branch', title: 'Tambah cabang', hint: 'Titik lokasi kantor dan radius check-in', href: '/app/branches', done: progress.branches > 0 },
    { id: 'shift', title: 'Atur shift kerja', hint: 'Jam masuk, jam pulang, dan toleransi terlambat', href: '/app/shifts', done: progress.shifts > 0 },
    {
      id: 'people',
      title: 'Tambah karyawan',
      hint: 'Beri shift agar mereka bisa check-in',
      href: '/app/employees',
      done: progress.trackedPeople > 0,
    },
    { id: 'checkin', title: 'Coba Check-in Saya', hint: 'Rasakan alur karyawan Anda sendiri', href: '/app/check-in', done: progress.hasOwnCheckIn },
  ];
}

// ---------------------------------------------------------------------------------------------
// Clock text in the organization's own time zone
// ---------------------------------------------------------------------------------------------
const clockFormatters = new Map<string, Intl.DateTimeFormat>();

/** "2026-10-09T01:02:00Z" in Asia/Jakarta -> "08.02" (the id-ID clock, like every other time in the app). */
export function formatClock(iso: string, timeZone: string): string {
  let formatter = clockFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('id-ID', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
    clockFormatters.set(timeZone, formatter);
  }
  return formatter.format(new Date(iso));
}
