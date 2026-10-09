// Pure maths behind /app/statistik: the daily attendance-rate series, the status mix, the
// check-in hour histogram and the busiest weekday. The queries (lib/queries/analytics.ts,
// calendar.ts) only count; every ratio, gap rule and tie-break is here and unit-tested
// (tests/statistics.test.ts).

import { WEEKDAY_SHORT, formatShortDate } from './calendar-grid';

export interface DayCounts {
  date: string; // YYYY-MM-DD
  present: number;
  late: number;
  absent: number;
  /** Approved leave, sick and permit rows. */
  away: number;
}

export interface TrendPoint {
  date: string;
  label: string;
  /** Percent 0..100: (present + late) / (present + late + absent). */
  rate: number;
  attended: number;
  obligated: number;
  /** Today: the day is not over, so the figure may still move. */
  partial: boolean;
}

/**
 * Attendance rate per working day. A day with no expected attendance (weekend, holiday, nothing
 * recorded: present + late + absent = 0) is left out, not drawn as 0%, so the line follows working
 * days only and a weekend never reads as a collapse. Sorted by date.
 */
export function attendanceRateSeries(days: readonly DayCounts[], today: string): TrendPoint[] {
  return days
    .map((d) => {
      const attended = d.present + d.late;
      const obligated = attended + d.absent;
      return { d, attended, obligated };
    })
    .filter(({ obligated }) => obligated > 0)
    .map(({ d, attended, obligated }) => ({
      date: d.date,
      label: formatShortDate(d.date),
      rate: Math.round((attended / obligated) * 1000) / 10,
      attended,
      obligated,
      partial: d.date === today,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface StatusMix {
  present: number;
  late: number;
  absent: number;
  away: number;
  total: number;
}

export function statusMix(days: readonly DayCounts[]): StatusMix {
  const mix = days.reduce(
    (acc, d) => ({
      present: acc.present + d.present,
      late: acc.late + d.late,
      absent: acc.absent + d.absent,
      away: acc.away + d.away,
    }),
    { present: 0, late: 0, absent: 0, away: 0 },
  );
  return { ...mix, total: mix.present + mix.late + mix.absent + mix.away };
}

export interface TrendSummary {
  /** Share of expected days that were attended, whole period, percent with one decimal. */
  overallRate: number | null;
  /** Share of attended days that were late. */
  lateShare: number | null;
  best: TrendPoint | null;
  worst: TrendPoint | null;
}

export function summarizeTrend(series: readonly TrendPoint[], mix: StatusMix): TrendSummary {
  const attended = mix.present + mix.late;
  const obligated = attended + mix.absent;
  let best: TrendPoint | null = null;
  let worst: TrendPoint | null = null;
  for (const point of series) {
    if (best === null || point.rate > best.rate) best = point;
    if (worst === null || point.rate < worst.rate) worst = point;
  }
  return {
    overallRate: obligated > 0 ? Math.round((attended / obligated) * 1000) / 10 : null,
    lateShare: attended > 0 ? Math.round((mix.late / attended) * 1000) / 10 : null,
    best,
    worst,
  };
}

export interface PeriodComparison {
  /** Change in the attendance rate, in percentage points (one decimal). Null when either side has no data. */
  rateDelta: number | null;
  /** Change in the late share, in percentage points. Null when either side has no data. */
  lateShareDelta: number | null;
}

/** This period against the one of the same length before it, as differences in percentage points. */
export function comparePeriods(current: TrendSummary, previous: TrendSummary): PeriodComparison {
  const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 10) / 10);
  return {
    rateDelta: delta(current.overallRate, previous.overallRate),
    lateShareDelta: delta(current.lateShare, previous.lateShare),
  };
}

export interface HourBucket {
  hour: number; // 0..23 in the org's time zone
  count: number;
}

export interface HourHistogram {
  /** The hours worth drawing: the span with data, padded by an hour each side, at least 6 wide. */
  buckets: HourBucket[];
  total: number;
  peakHour: number | null;
  peakCount: number;
}

const MIN_HOUR_SPAN = 6;

export function hourHistogram(rows: readonly HourBucket[]): HourHistogram {
  const counts = new Array<number>(24).fill(0);
  for (const row of rows) {
    if (Number.isInteger(row.hour) && row.hour >= 0 && row.hour <= 23 && row.count > 0) counts[row.hour]! += row.count;
  }
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total === 0) return { buckets: [], total: 0, peakHour: null, peakCount: 0 };

  const first = counts.findIndex((c) => c > 0);
  const last = counts.length - 1 - [...counts].reverse().findIndex((c) => c > 0);
  let from = Math.max(0, first - 1);
  let to = Math.min(23, last + 1);
  // Widen to the minimum span, to the right first, then to the left when the day ends at 23.
  while (to - from + 1 < MIN_HOUR_SPAN) {
    if (to < 23) to += 1;
    else if (from > 0) from -= 1;
    else break;
  }

  let peakHour = from;
  let peakCount = -1;
  const buckets: HourBucket[] = [];
  for (let hour = from; hour <= to; hour += 1) {
    const count = counts[hour]!;
    buckets.push({ hour, count });
    if (count > peakCount) {
      peakCount = count;
      peakHour = hour;
    }
  }
  return { buckets, total, peakHour, peakCount };
}

export interface WeekdayRow {
  /** ISO weekday, 1 = Monday. */
  dow: number;
  attended: number;
  late: number;
  absent: number;
  /** Distinct dates with at least one row on that weekday. */
  days: number;
}

export interface WeekdayStat {
  dow: number;
  label: string;
  /** Average check-ins per such day. */
  avgAttended: number;
  /** Late share of attended, percent. */
  lateRate: number | null;
  days: number;
  attended: number;
}

export interface WeekdaySummary {
  /** Mon..Sun, always seven entries. */
  stats: WeekdayStat[];
  /** The weekday with the most check-ins per day; null when there are none. */
  busiest: WeekdayStat | null;
}

export function weekdaySummary(rows: readonly WeekdayRow[]): WeekdaySummary {
  const stats: WeekdayStat[] = WEEKDAY_SHORT.map((label, i) => {
    const dow = i + 1;
    const row = rows.find((r) => r.dow === dow);
    const attended = row?.attended ?? 0;
    const days = row?.days ?? 0;
    return {
      dow,
      label,
      attended,
      days,
      avgAttended: days > 0 ? Math.round((attended / days) * 10) / 10 : 0,
      lateRate: row && attended > 0 ? Math.round((row.late / attended) * 1000) / 10 : null,
    };
  });
  let busiest: WeekdayStat | null = null;
  for (const stat of stats) {
    if (stat.attended > 0 && (busiest === null || stat.avgAttended > busiest.avgAttended)) busiest = stat;
  }
  return { stats, busiest };
}

/** 7 -> "07.00", for axis labels in the id-ID clock style. */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}.00`;
}

/** 1, 2, 5 x 10^k at or above `value`, so the axis ends on a clean number. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * base) return step * base;
  }
  return 10 * base;
}
