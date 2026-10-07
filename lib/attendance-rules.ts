// Pure, timezone-aware attendance rules (ERD.md §3.2, TRD.md §7). Unit-tested in
// tests/attendance-rules.test.ts against the seed rows in ERD.md §4 — do not add any
// I/O here; route handlers and lib/queries own the database and clock access.

import { addDaysToDateString, getLocalParts, parseDate, formatDate, zonedTimeToInstant } from './tz';

export interface ShiftRule {
  timeIn: string; // "HH:MM" or "HH:MM:SS"
  timeOut: string;
  breakMinutes: number;
  lateToleranceMinutes: number;
  isCrossDay: boolean;
}

/**
 * The work date an instant belongs to, in the org's timezone. For a cross-day shift,
 * an instant before that shift's `timeOut` (local time-of-day) belongs to the previous
 * calendar date — e.g. a 22:00–06:00 shift's 02:00 check-in is still "yesterday's" shift.
 */
export function computeWorkDate(instant: Date, timezone: string, shift: Pick<ShiftRule, 'timeOut' | 'isCrossDay'>): string {
  const local = getLocalParts(instant, timezone);
  const localDate = formatDate(local.year, local.month, local.day);
  if (!shift.isCrossDay) return localDate;

  const localTime = `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}:${String(local.second).padStart(2, '0')}`;
  const normalizedTimeOut = normalizeTime(shift.timeOut);
  return localTime < normalizedTimeOut ? addDaysToDateString(localDate, -1) : localDate;
}

function normalizeTime(time: string): string {
  const [h = 0, m = 0, s = 0] = time.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function scheduledInstant(workDate: string, time: string, timezone: string, dayOffset = 0): Date {
  const { year, month, day } = parseDate(dayOffset === 0 ? workDate : addDaysToDateString(workDate, dayOffset));
  const [h = 0, m = 0, s = 0] = time.split(':').map(Number);
  return zonedTimeToInstant(year, month, day, h, m, s, timezone);
}

export function scheduledCheckInInstant(workDate: string, shift: Pick<ShiftRule, 'timeIn'>, timezone: string): Date {
  return scheduledInstant(workDate, shift.timeIn, timezone, 0);
}

export function scheduledCheckOutInstant(
  workDate: string,
  shift: Pick<ShiftRule, 'timeOut' | 'isCrossDay'>,
  timezone: string,
): Date {
  return scheduledInstant(workDate, shift.timeOut, timezone, shift.isCrossDay ? 1 : 0);
}

/**
 * Minutes late, 0 when within tolerance. `checkInAt > scheduled + tolerance` → late
 * (ERD.md §3.2); otherwise PRESENT with `late_minutes = 0`.
 */
export function lateMinutes(
  checkInAt: Date,
  workDate: string,
  shift: Pick<ShiftRule, 'timeIn' | 'lateToleranceMinutes'>,
  timezone: string,
): number {
  const scheduled = scheduledCheckInInstant(workDate, shift, timezone);
  const diffMin = (checkInAt.getTime() - scheduled.getTime()) / 60_000;
  if (diffMin <= shift.lateToleranceMinutes) return 0;
  return Math.floor(diffMin);
}

/** Minutes left before the scheduled end of shift, 0 when checking out on time or later. */
export function earlyLeaveMinutes(
  checkOutAt: Date,
  workDate: string,
  shift: Pick<ShiftRule, 'timeOut' | 'isCrossDay'>,
  timezone: string,
): number {
  const scheduled = scheduledCheckOutInstant(workDate, shift, timezone);
  const diffMin = (scheduled.getTime() - checkOutAt.getTime()) / 60_000;
  return diffMin > 0 ? Math.floor(diffMin) : 0;
}

/** `floor((check_out − check_in) / 60s) − break_minutes`, minimum 0 (ERD.md §3.2). */
export function workMinutes(checkInAt: Date, checkOutAt: Date, breakMinutes: number): number {
  const totalMin = Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60_000);
  return Math.max(0, totalMin - breakMinutes);
}

/** Late-minute report category (Digispace convention, ERD.md §3.2). */
export function lateCategory(minutes: number): 'A' | 'B' | 'C' | null {
  if (minutes <= 0) return null;
  if (minutes <= 15) return 'A';
  if (minutes <= 30) return 'B';
  return 'C';
}
