// Display helpers shared by /app/terlambat, /app/luar-area and /app/selfie. Pure, id-ID, and built on
// "YYYY-MM-DD" calendar strings pinned to UTC so no server timezone can move a date by a day.

import { daysInRange } from './date-range';
import { parseDate } from './tz';

const UTC_DAY = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

const WEEKDAY_DATE = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY_SHORT = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const LONG_DATE = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT_DATE = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const MONTH_ONLY = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' });

function at(date: string): Date {
  const { year, month, day } = parseDate(date);
  return UTC_DAY(year, month, day);
}

/** "Sel, 6 Okt 2026" */
export function formatWorkDate(date: string): string {
  return WEEKDAY_DATE.format(at(date));
}

/** "Sel, 6 Okt": a card-sized date, the year is already in the page's period. */
export function formatDayShort(date: string): string {
  return DAY_SHORT.format(at(date));
}

/** "6 Oktober 2026" */
export function formatLongDate(date: string): string {
  return LONG_DATE.format(at(date));
}

/** "6 Okt 2026" */
export function formatShortDate(date: string): string {
  return SHORT_DATE.format(at(date));
}

/**
 * A period as one phrase: "7 Okt 2026", "1–7 Okt 2026", "28 Sep – 7 Okt 2026" or, across years,
 * "30 Des 2026 – 2 Jan 2027". Used in page descriptions and empty states so the period named in
 * words always matches the one in the filter.
 */
export function formatPeriod(from: string, to: string): string {
  if (from === to) return formatShortDate(from);
  const a = parseDate(from);
  const b = parseDate(to);
  if (a.year !== b.year) return `${formatShortDate(from)} – ${formatShortDate(to)}`;
  if (a.month === b.month) return `${a.day}–${b.day} ${MONTH_ONLY.format(UTC_DAY(b.year, b.month, 1))} ${b.year}`;
  return `${DAY_MONTH.format(at(from))} – ${formatShortDate(to)}`;
}

/** "hari ini", "kemarin", "3 hari lalu": how long ago a work date was, relative to the org's today. */
export function formatDaysAgo(date: string, today: string): string {
  if (date >= today) return 'hari ini';
  const n = daysInRange(date, today) - 1;
  return n <= 1 ? 'kemarin' : `${n} hari lalu`;
}

/** Percent of `part` in `whole`, rounded, 0 when there is no whole. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
