// Everything the punch routes, the precheck route, GET /api/me and the "Hari ini" screen need to
// agree on what happens next for one person: organisation, shift, branches, today's date and
// holiday, today's log and the open log, resolved by the pure rules in lib/punch.ts. One loader,
// two phases (org + shift first, then everything keyed by the work date in parallel), so the five
// callers cannot drift apart. Every query is scoped by the session's org_id (AGENTS.md rule #1).

import { NotFoundError } from './db';
import { cached, cacheKeys } from './redis';
import { computeWorkDate } from './attendance-rules';
import { safeTimezone } from './safe-timezone';
import { dayKindFor, pickOpenLog, resolvePunchTarget, isCloseable, type DayKind, type PunchTarget } from './punch';
import { getOrganizationPlanContext, type OrganizationPlanContext } from './queries/organizations';
import { getShiftByIdInOrg, type ShiftSummary } from './queries/shifts';
import { listBranches, type BranchSummary } from './queries/branches';
import {
  getHolidayNameForDate,
  getLogByUserAndDate,
  listOpenLogsForUser,
  type AttendanceLogRow,
  type OpenLogRow,
} from './queries/attendance';

export interface PunchContext {
  now: Date;
  org: OrganizationPlanContext;
  /** Null when the person is untracked or the shift id does not resolve inside this org. */
  shift: ShiftSummary | null;
  allBranches: BranchSummary[];
  activeBranches: BranchSummary[];
  /** The work date `now` belongs to under the person's shift; null without a usable shift. */
  workDate: string | null;
  holidayName: string | null;
  dayKind: DayKind;
  todayLog: AttendanceLogRow | null;
  /** The newest open log that can still be closed by a check-out (maybe of the previous work date). */
  openLog: OpenLogRow | null;
  /** An open log from an earlier work date whose check-out window has closed: needs a correction request. */
  staleOpenLog: OpenLogRow | null;
  target: PunchTarget<AttendanceLogRow, OpenLogRow> | null;
}

export async function loadOrgContext(orgId: number): Promise<OrganizationPlanContext> {
  const org = await cached(cacheKeys.orgCtx(orgId), 600, () => getOrganizationPlanContext(orgId));
  if (!org) throw new Error(`Organization ${orgId} missing a plan context`);
  return org.timezone === safeTimezone(org.timezone) ? org : { ...org, timezone: safeTimezone(org.timezone) };
}

export async function loadPunchContext(input: {
  orgId: number;
  userId: number;
  shiftId: number | null;
  now?: Date;
}): Promise<PunchContext> {
  const now = input.now ?? new Date();
  const [org, shift] = await Promise.all([
    loadOrgContext(input.orgId),
    input.shiftId === null
      ? Promise.resolve(null)
      : getShiftByIdInOrg(input.orgId, input.shiftId).catch((error: unknown) => {
          if (error instanceof NotFoundError) return null;
          throw error;
        }),
  ]);

  if (!shift) {
    const allBranches = await listBranches(input.orgId);
    return {
      now,
      org,
      shift: null,
      allBranches,
      activeBranches: allBranches.filter((b) => b.isActive),
      workDate: null,
      holidayName: null,
      dayKind: 'WORK',
      todayLog: null,
      openLog: null,
      staleOpenLog: null,
      target: null,
    };
  }

  const workDate = computeWorkDate(now, org.timezone, shift);
  const [allBranches, holidayName, todayLog, openLogs] = await Promise.all([
    listBranches(input.orgId),
    getHolidayNameForDate(input.orgId, workDate),
    getLogByUserAndDate(input.orgId, input.userId, workDate),
    listOpenLogsForUser(input.orgId, input.userId),
  ]);

  const openLog = pickOpenLog(openLogs, now, org.timezone);
  const staleOpenLog = openLogs.find((log) => log.workDate !== workDate && !isCloseable(log, now, org.timezone)) ?? null;
  const target = resolvePunchTarget({ now, timezone: org.timezone, shift, todayLog, openLog });
  return {
    now,
    org,
    shift,
    allBranches,
    activeBranches: allBranches.filter((b) => b.isActive),
    workDate,
    holidayName,
    dayKind: dayKindFor(workDate, shift.workDays, holidayName),
    todayLog,
    openLog,
    staleOpenLog,
    target,
  };
}
