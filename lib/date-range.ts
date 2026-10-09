// Pure date-range helpers for the period-based admin pages (/app/terlambat, /app/luar-area,
// /app/selfie): parse `?dateFrom=&dateTo=` defensively, clamp to a maximum span, and detect which
// quick preset ("Hari ini", "7 hari", ...) the range equals. No I/O and no Date.now(): "today" is a
// parameter (the org's own calendar date), so every case is unit-testable (tests/date-range.test.ts).
// Built on the calendar-date string helpers in lib/tz.ts: dates are "YYYY-MM-DD" strings end to end,
// never JS Dates, so no server timezone can shift a day.

import { addDaysToDateString, formatDate, parseDate } from './tz';

export type Preset = 'today' | '7d' | '30d' | 'month' | 'lastmonth' | 'custom';
export type QuickPreset = Exclude<Preset, 'custom'>;

/** Order matters for detection: on the 1st of a month "month" equals "today", and "today" wins. */
export const QUICK_PRESETS: readonly QuickPreset[] = ['today', '7d', '30d', 'month', 'lastmonth'];

export const PRESET_LABELS: Record<QuickPreset, string> = {
  today: 'Hari ini',
  '7d': '7 hari',
  '30d': '30 hari',
  month: 'Bulan ini',
  lastmonth: 'Bulan lalu',
};

export interface DateRange {
  from: string;
  to: string;
}

export interface Period extends DateRange {
  preset: Preset;
  /** True when the requested span was longer than maxDays and `from` was moved forward. */
  clamped: boolean;
}

export interface ParsePeriodOptions {
  /** The org's calendar date today, "YYYY-MM-DD". */
  today: string;
  /** Longest span in days (inclusive of both ends). */
  maxDays: number;
  /** Start of the range when `dateFrom` is missing or invalid. */
  defaultFrom: (today: string) => string;
}

/** A real calendar date in "YYYY-MM-DD" form ("2026-02-31" is rejected, "2028-02-29" is fine). */
export function isCalendarDate(value: string | undefined | null): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseDate(value);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Whole days from `from` to `to` inclusive (a single day is 1). Negative spans give 0. */
export function daysInRange(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  const diff = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
  return diff < 0 ? 0 : diff + 1;
}

/** First day of the month `date` is in. */
function startOfMonth(date: string): string {
  const { year, month } = parseDate(date);
  return formatDate(year, month, 1);
}

/** The range a quick preset stands for, relative to `today`. */
export function presetRange(preset: QuickPreset, today: string): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: addDaysToDateString(today, -6), to: today };
    case '30d':
      return { from: addDaysToDateString(today, -29), to: today };
    case 'month':
      return { from: startOfMonth(today), to: today };
    case 'lastmonth': {
      const lastOfPrev = addDaysToDateString(startOfMonth(today), -1);
      return { from: startOfMonth(lastOfPrev), to: lastOfPrev };
    }
  }
}

/** Which quick preset equals this range, or 'custom'. */
export function detectPreset(range: DateRange, today: string): Preset {
  for (const preset of QUICK_PRESETS) {
    const r = presetRange(preset, today);
    if (r.from === range.from && r.to === range.to) return preset;
  }
  return 'custom';
}

/**
 * Turns raw search params into a safe range. Rules:
 *  - a missing or invalid value falls back to the default (no error page);
 *  - both given and reversed: swapped; only one given and it conflicts with the default of the
 *    other end: the missing end follows the given one (a lone `dateTo` in the past is one day);
 *  - `to` is never after today, and `from` never after `to`;
 *  - a span longer than maxDays keeps `to` and moves `from` forward (`clamped` = true).
 */
export function parsePeriod(
  params: { dateFrom?: string; dateTo?: string },
  opts: ParsePeriodOptions,
): Period {
  const givenFrom = isCalendarDate(params.dateFrom) ? params.dateFrom : undefined;
  const givenTo = isCalendarDate(params.dateTo) ? params.dateTo : undefined;

  let from = givenFrom ?? opts.defaultFrom(opts.today);
  let to = givenTo ?? opts.today;

  if (from > to) {
    if (givenFrom && givenTo) [from, to] = [to, from];
    else if (givenTo) from = to;
    else to = from;
  }

  if (to > opts.today) to = opts.today;
  if (from > to) from = to;

  let clamped = false;
  if (daysInRange(from, to) > opts.maxDays) {
    from = addDaysToDateString(to, -(opts.maxDays - 1));
    clamped = true;
  }

  return { from, to, clamped, preset: detectPreset({ from, to }, opts.today) };
}
