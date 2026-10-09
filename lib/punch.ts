// Pure punch rules shared by the check-in route, the check-out route, the precheck route,
// GET /api/me and the "Hari ini" screen, so those five can never disagree about what the next
// action is (ERD.md §3.2, TRD.md §7). No I/O: unit-tested in tests/punch.test.ts.

import {
  computeWorkDate,
  lateMinutes as computeLateMinutes,
  scheduledCheckOutInstant,
  type ShiftRule,
} from './attendance-rules';
import { workDaysSetFromString } from './constants/statuses';

/** A calendar day's character for one person: a normal work day, a day off the shift does not
 * work (weekend), or a holiday. HOLIDAY wins over OFF so a holiday on a Sunday reads as one. */
export type DayKind = 'WORK' | 'OFF' | 'HOLIDAY';

/** ISO weekday (1 = Monday ... 7 = Sunday) of a "YYYY-MM-DD" calendar date. */
export function isoWeekday(workDate: string): number {
  const [y, m, d] = workDate.slice(0, 10).split('-').map(Number);
  const dow = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = Sunday
  return dow === 0 ? 7 : dow;
}

/** `shifts.work_days` is a comma list of ISO weekdays; an empty/garbled list never matches.
 * Still accepts a number: it is cheap, and a caller that builds a shift by hand (a test, a seed)
 * may pass one. lib/db.ts itself no longer turns the one-day list "6" into the number 6
 * (lib/db-types.ts parses by column type), so a row from the database is always the text. */
export function isWorkDay(workDate: string, workDays: string | number): boolean {
  return workDaysSetFromString(String(workDays ?? '')).has(isoWeekday(workDate));
}

export function dayKindFor(workDate: string, workDays: string | number, holidayName: string | null): DayKind {
  if (holidayName) return 'HOLIDAY';
  return isWorkDay(workDate, workDays) ? 'WORK' : 'OFF';
}

/**
 * Status and late minutes of a check-in. ERD.md §3.2: "Holidays and off days do not block
 * check-in ... A check-in on such a day is stored as PRESENT with late_minutes = 0."
 */
export function classifyCheckIn(input: {
  now: Date;
  workDate: string;
  shift: Pick<ShiftRule, 'timeIn' | 'lateToleranceMinutes'>;
  timezone: string;
  dayKind: DayKind;
}): { status: 'PRESENT' | 'LATE'; lateMinutes: number } {
  if (input.dayKind !== 'WORK') return { status: 'PRESENT', lateMinutes: 0 };
  const late = computeLateMinutes(input.now, input.workDate, input.shift, input.timezone);
  return late > 0 ? { status: 'LATE', lateMinutes: late } : { status: 'PRESENT', lateMinutes: 0 };
}

/** How long after the scheduled end an open log can still be closed with a normal check-out.
 * Past it the person files a correction request instead (and tomorrow's check-in is never
 * blocked by yesterday's forgotten check-out). */
export const CHECKOUT_GRACE_HOURS = 6;
const CHECKOUT_GRACE_MS = CHECKOUT_GRACE_HOURS * 3_600_000;
/** Fallback when a log has no snapshotted `scheduled_out` (a REQUEST row): the longest plausible shift. */
const MAX_OPEN_SHIFT_MS = 16 * 3_600_000;

/** A log that has a check-in but no check-out yet, with the bits of its shift snapshot needed to
 * decide how long it stays closeable. */
export interface OpenLogLike {
  id: number;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  scheduledIn: string | null;
  scheduledOut: string | null;
  shiftIsCrossDay: boolean;
}

/** The instant after which an open log can no longer be closed by a check-out. */
export function checkoutDeadline(log: OpenLogLike, timezone: string): Date | null {
  if (log.scheduledOut) {
    const end = scheduledCheckOutInstant(
      log.workDate,
      { timeOut: log.scheduledOut, isCrossDay: log.shiftIsCrossDay },
      timezone,
    );
    return new Date(end.getTime() + CHECKOUT_GRACE_MS);
  }
  if (log.checkInAt) return new Date(new Date(log.checkInAt).getTime() + MAX_OPEN_SHIFT_MS);
  return null;
}

/** True while `log` can still be closed by a check-out at `now`. */
export function isCloseable(log: OpenLogLike, now: Date, timezone: string): boolean {
  if (!log.checkInAt || log.checkOutAt) return false;
  const deadline = checkoutDeadline(log, timezone);
  return deadline !== null && now.getTime() <= deadline.getTime();
}

/** The newest log that has a check-in, no check-out, and is still within its check-out window. */
export function pickOpenLog<T extends OpenLogLike>(logs: readonly T[], now: Date, timezone: string): T | null {
  let best: T | null = null;
  for (const log of logs) {
    if (!isCloseable(log, now, timezone)) continue;
    if (!best || new Date(log.checkInAt!).getTime() > new Date(best.checkInAt!).getTime()) best = log;
  }
  return best;
}

/** The minimum of a log the resolver needs. The route and the page pass the full row. */
export interface LogLike {
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
}

/**
 * - `check-in`    nothing recorded yet for this work date
 * - `check-out`   an open log is still closeable (it may belong to the previous date: overtime
 *                 past midnight, or a cross-day shift)
 * - `done`        checked in and out
 * - `recorded`    today's row exists without a check-in (approved leave / sick / permit, a
 *                 holiday or absent row): nothing to punch
 * - `expired`     checked in but the check-out window has closed: needs a correction request
 */
export type PunchAction = 'check-in' | 'check-out' | 'done' | 'recorded' | 'expired';

export interface PunchTarget<TToday extends LogLike, TOpen extends OpenLogLike> {
  action: PunchAction;
  /** The log the action applies to (the open log for check-out, today's log otherwise). */
  log: TToday | TOpen | null;
  workDate: string;
}

export function resolvePunchTarget<TToday extends LogLike, TOpen extends OpenLogLike>(input: {
  now: Date;
  timezone: string;
  shift: Pick<ShiftRule, 'timeOut' | 'isCrossDay'>;
  todayLog: TToday | null;
  openLog: TOpen | null;
}): PunchTarget<TToday, TOpen> {
  const workDate = computeWorkDate(input.now, input.timezone, input.shift);

  if (input.openLog && isCloseable(input.openLog, input.now, input.timezone)) {
    return { action: 'check-out', log: input.openLog, workDate: input.openLog.workDate };
  }
  const today = input.todayLog;
  if (today) {
    if (!today.checkInAt) return { action: 'recorded', log: today, workDate };
    if (today.checkOutAt) return { action: 'done', log: today, workDate };
    return { action: 'expired', log: today, workDate };
  }
  return { action: 'check-in', log: null, workDate };
}
