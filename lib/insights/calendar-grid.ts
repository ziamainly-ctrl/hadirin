// Pure calendar maths for /app/kalender and the month pickers of /app/peringkat. Everything
// works on "YYYY-MM" and "YYYY-MM-DD" strings and never on a local `Date`, so a date can
// never slip a day when the server runs in another time zone than the organization
// (a Date at UTC midnight read in WIB is the same day, but one read in UTC-5 is the day before).

import { addDaysToDateString, pad2, parseDate } from '../tz';

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Mon-first labels (ISO weekday 1..7), as the calendar header prints them. */
export const WEEKDAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;
export const WEEKDAY_LONG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;
export const MONTH_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

/** True for a real calendar date ("2026-02-31" is not one). */
export function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const { year, month, day } = parseDate(value);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** ISO weekday of a "YYYY-MM-DD" date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const { year, month, day } = parseDate(date);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

export function daysInMonth(month: string): number {
  const { year, month: m } = parseDate(`${month}-01`);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function monthEnd(month: string): string {
  return `${month}-${pad2(daysInMonth(month))}`;
}

/** "2026-10-07" -> "2026-10". */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

function monthIndex(month: string): number {
  const { year, month: m } = parseDate(`${month}-01`);
  return year * 12 + (m - 1);
}

function monthFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  return `${year}-${pad2((index % 12) + 1)}`;
}

/** The month `delta` months from `month` (negative = earlier). */
export function shiftMonth(month: string, delta: number): string {
  return monthFromIndex(monthIndex(month) + delta);
}

export interface MonthRange {
  /** How many months before the current month can be opened. */
  monthsBack: number;
  /** How many months after the current month can be opened. */
  monthsForward: number;
}

export const DEFAULT_MONTH_RANGE: MonthRange = { monthsBack: 24, monthsForward: 1 };

/**
 * A `?month=` value turned into a month that may be shown: malformed or missing values fall
 * back to the current month; a real month outside the allowed window is clamped to its
 * nearest edge (24 months back, 1 forward by default).
 */
export function parseMonthParam(
  raw: string | undefined,
  currentMonth: string,
  range: MonthRange = DEFAULT_MONTH_RANGE,
): string {
  if (!raw || !MONTH_PATTERN.test(raw)) return currentMonth;
  const index = monthIndex(raw);
  const current = monthIndex(currentMonth);
  const clamped = Math.min(Math.max(index, current - range.monthsBack), current + range.monthsForward);
  return monthFromIndex(clamped);
}

/** "2026-10" -> "Oktober 2026". */
export function formatMonthLabel(month: string): string {
  const { year, month: m } = parseDate(`${month}-01`);
  return `${MONTH_LONG[m - 1]} ${year}`;
}

/** "2026-10-07" -> "7 Okt". */
export function formatShortDate(date: string): string {
  const { month, day } = parseDate(date);
  return `${day} ${MONTH_SHORT[month - 1]}`;
}

/** "2026-10-07" -> "Rabu, 7 Oktober 2026". */
export function formatLongDate(date: string): string {
  const { year, month, day } = parseDate(date);
  return `${WEEKDAY_LONG[isoWeekday(date) - 1]}, ${day} ${MONTH_LONG[month - 1]} ${year}`;
}

export interface GridDay {
  date: string;
  /** Day of month, 1..31. */
  day: number;
  /** False for the leading/trailing days of the neighbouring months that pad the week rows. */
  inMonth: boolean;
  /** ISO weekday, 1 = Monday. */
  weekday: number;
}

/**
 * The weeks of a month, Monday first, each 7 days. The first and last week are padded with the
 * neighbouring months' days (`inMonth: false`) so every row is complete: 4 to 6 rows.
 */
export function buildMonthGrid(month: string): GridDay[][] {
  const first = monthStart(month);
  const offset = isoWeekday(first) - 1; // days of the previous month shown in week 1
  const total = offset + daysInMonth(month);
  const rows = Math.ceil(total / 7);
  const gridStart = addDaysToDateString(first, -offset);
  const weeks: GridDay[][] = [];
  for (let r = 0; r < rows; r += 1) {
    const week: GridDay[] = [];
    for (let c = 0; c < 7; c += 1) {
      const date = addDaysToDateString(gridStart, r * 7 + c);
      week.push({ date, day: parseDate(date).day, inMonth: monthOf(date) === month, weekday: c + 1 });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Every date of a month, in order. */
export function listMonthDates(month: string): string[] {
  const count = daysInMonth(month);
  return Array.from({ length: count }, (_, i) => `${month}-${pad2(i + 1)}`);
}
