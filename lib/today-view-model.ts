// The serializable shape the "Hari ini" server component hands to its client islands, and the
// pure functions that build it. Keeping the mapping here means the client never receives a raw
// Blob URL (selfies are private; they are shown through /api/files) or a DB row it does not need,
// and the week/duration logic is unit-tested (tests/today-view-model.test.ts).

import { addDaysToDateString } from './tz';
import { scheduledCheckOutInstant } from './attendance-rules';
import type { AttendanceStatus } from './constants/statuses';

/** One log as the screen shows it. */
export interface TodayLogView {
  id: number;
  workDate: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInBranchName: string | null;
  checkOutBranchName: string | null;
  checkInDistanceM: number | null;
  checkOutDistanceM: number | null;
  checkInIsOutside: boolean;
  checkOutIsOutside: boolean;
  hasCheckInPhoto: boolean;
  hasCheckOutPhoto: boolean;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number | null;
  note: string | null;
  /** The scheduled end of this log's shift as an ISO instant; display-only, for the early-leave warning. */
  scheduledOutAt: string | null;
}

export interface WeekDayView {
  date: string;
  status: AttendanceStatus | null;
}

/** The fields of a row the mapper reads (AttendanceLogRow satisfies it). */
export interface LogSource {
  id: number;
  workDate: string;
  status: AttendanceStatus;
  scheduledOut: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInBranchId: number | null;
  checkOutBranchId: number | null;
  checkInDistanceM: number | null;
  checkOutDistanceM: number | null;
  checkInIsOutside: boolean;
  checkOutIsOutside: boolean;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number | null;
  note: string | null;
}

export function toTodayLogView(
  log: LogSource,
  branches: readonly { id: number; name: string }[],
  shift: { timeOut: string; isCrossDay: boolean },
  timezone: string,
): TodayLogView {
  const nameOf = (id: number | null) => (id === null ? null : (branches.find((b) => b.id === id)?.name ?? null));
  const scheduledOut = log.scheduledOut ?? shift.timeOut;
  return {
    id: log.id,
    workDate: log.workDate,
    status: log.status,
    checkInAt: log.checkInAt,
    checkOutAt: log.checkOutAt,
    checkInBranchName: nameOf(log.checkInBranchId),
    checkOutBranchName: nameOf(log.checkOutBranchId),
    checkInDistanceM: log.checkInDistanceM,
    checkOutDistanceM: log.checkOutDistanceM,
    checkInIsOutside: log.checkInIsOutside,
    checkOutIsOutside: log.checkOutIsOutside,
    hasCheckInPhoto: Boolean(log.checkInPhotoUrl),
    hasCheckOutPhoto: Boolean(log.checkOutPhotoUrl),
    lateMinutes: log.lateMinutes,
    earlyLeaveMinutes: log.earlyLeaveMinutes,
    workMinutes: log.workMinutes,
    note: log.note,
    scheduledOutAt: scheduledCheckOutInstant(log.workDate, { timeOut: scheduledOut, isCrossDay: shift.isCrossDay }, timezone).toISOString(),
  };
}

/** The 7 calendar dates ending `today`, oldest first, each with that day's status (null = no record). */
export function buildWeek(
  today: string,
  logs: readonly { workDate: string; status: AttendanceStatus }[],
): WeekDayView[] {
  const byDate = new Map(logs.map((log) => [log.workDate.slice(0, 10), log.status]));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDateString(today, i - 6);
    return { date, status: byDate.get(date) ?? null };
  });
}

/** Whole minutes from `now` until `target`, 0 when it has passed. */
export function minutesUntil(target: string | null, now: number): number {
  if (!target) return 0;
  const diff = (new Date(target).getTime() - now) / 60_000;
  return diff > 0 ? Math.ceil(diff) : 0;
}
