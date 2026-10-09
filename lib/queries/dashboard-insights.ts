import { sql } from '../db';
import type { DayCounts } from '../insights/statistics';
import type { AttendanceScope } from './calendar';

// Read-only aggregates behind the admin dashboard (/app): the daily series that feeds the KPI
// sparklines, the trend and the weekday heatmap, the "same time on the last working day" snapshot
// behind the KPI deltas, today's worst late arrivals, the pending approvals count and the setup
// checklist of an empty organization. Same rules as calendar.ts and analytics.ts: every statement
// starts at `org_id = $1`, a MANAGER is scoped to `users.manager_id = $n` (direct reports) with the
// users join repeating the org, dates leave SQL as "YYYY-MM-DD" text and every count is cast to
// ::int so nothing depends on how the driver parses numbers. No cache here; app/app/dashboard/data.ts
// decides what is cached (only the roster, which already is: TRD.md section 10).

/** The scope a dashboard query accepts: org-wide (empty) or a manager's direct reports. */
export type DashboardScope = Pick<AttendanceScope, 'managerId'>;

function scopeJoin(scope: DashboardScope, params: unknown[]): { join: string; where: string } {
  if (scope.managerId === undefined) return { join: '', where: '' };
  params.push(scope.managerId);
  return {
    join: 'JOIN users u ON u.id = a.user_id AND u.org_id = a.org_id',
    where: ` AND u.manager_id = $${params.length}`,
  };
}

export interface DailyOverviewRow extends DayCounts {
  /** Check-ins flagged outside the geofence that day. */
  outside: number;
}

/**
 * One row per work date in [from, to] that has at least one attendance row: on time, late, absent,
 * away (leave / sick / permit) and check-ins outside the geofence. HOLIDAY and OFF rows are not
 * "people at work" and are not counted, exactly as in lib/queries/calendar.ts getDailyStatusCounts.
 */
export async function getDailyOverview(
  orgId: number,
  from: string,
  to: string,
  scope: DashboardScope = {},
): Promise<DailyOverviewRow[]> {
  const params: unknown[] = [orgId, from, to];
  const { join, where } = scopeJoin(scope, params);
  const rows = await sql.query(
    `SELECT a.work_date::text AS "date",
            count(*) FILTER (WHERE a.status = 'PRESENT')::int AS present,
            count(*) FILTER (WHERE a.status = 'LATE')::int AS late,
            count(*) FILTER (WHERE a.status = 'ABSENT')::int AS absent,
            count(*) FILTER (WHERE a.status IN ('LEAVE','SICK','PERMIT'))::int AS away,
            count(*) FILTER (WHERE a.check_in_is_outside)::int AS outside
       FROM attendance_logs a
       ${join}
      WHERE a.org_id = $1 AND a.work_date >= $2::date AND a.work_date <= $3::date${where}
      GROUP BY a.work_date
      ORDER BY a.work_date`,
    params,
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    date: String(r.date),
    present: Number(r.present),
    late: Number(r.late),
    absent: Number(r.absent),
    away: Number(r.away),
    outside: Number(r.outside),
  }));
}

export interface SameTimeSnapshot {
  /** The last working day before today (within a week), "YYYY-MM-DD"; null when there is none. */
  date: string | null;
  /** Everyone who was expected that day (on time + late + absent). */
  expected: number;
  /** Of those, how many had already checked in by this time of day (today's clock, that day). */
  attended: number;
  late: number;
  outside: number;
}

/**
 * What the last working day looked like AT THIS TIME OF DAY, so a delta read at 08:30 compares
 * today's morning with that day's morning, not with its final tally (a half-finished day would
 * otherwise always read as a collapse). "This time" is `now()` shifted back by the number of days
 * between the two work dates. A weekend or holiday in between is skipped: the comparison day is the
 * latest one with PRESENT, LATE or ABSENT rows in the 7 days before `today`.
 */
export async function getSameTimeSnapshot(orgId: number, today: string, scope: DashboardScope = {}): Promise<SameTimeSnapshot> {
  const params: unknown[] = [orgId, today];
  let prevScope = '';
  let logScope = '';
  if (scope.managerId !== undefined) {
    params.push(scope.managerId);
    const idx = params.length;
    prevScope = `AND EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id AND u.org_id = a.org_id AND u.manager_id = $${idx})`;
    logScope = `AND EXISTS (SELECT 1 FROM users u WHERE u.id = l.user_id AND u.org_id = l.org_id AND u.manager_id = $${idx})`;
  }
  const rows = await sql.query(
    `WITH prev AS (
       SELECT max(a.work_date) AS d
         FROM attendance_logs a
        WHERE a.org_id = $1 AND a.work_date < $2::date AND a.work_date >= ($2::date - 7)
          AND a.status IN ('PRESENT','LATE','ABSENT') ${prevScope}
     )
     SELECT prev.d::text AS "date",
            count(l.id) FILTER (WHERE l.status IN ('PRESENT','LATE','ABSENT'))::int AS expected,
            count(l.id) FILTER (WHERE l.status IN ('PRESENT','LATE')
                                  AND l.check_in_at <= now() - (($2::date - prev.d) * interval '1 day'))::int AS attended,
            count(l.id) FILTER (WHERE l.status = 'LATE'
                                  AND l.check_in_at <= now() - (($2::date - prev.d) * interval '1 day'))::int AS late,
            count(l.id) FILTER (WHERE l.check_in_is_outside
                                  AND l.check_in_at <= now() - (($2::date - prev.d) * interval '1 day'))::int AS outside
       FROM prev
       LEFT JOIN attendance_logs l ON l.org_id = $1 AND l.work_date = prev.d ${logScope}
      GROUP BY prev.d`,
    params,
  );
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r || r.date === null || r.date === undefined) return { date: null, expected: 0, attended: 0, late: 0, outside: 0 };
  return {
    date: String(r.date),
    expected: Number(r.expected),
    attended: Number(r.attended),
    late: Number(r.late),
    outside: Number(r.outside),
  };
}

export interface TodayLateRow {
  userId: number;
  name: string;
  lateMinutes: number;
  branchName: string | null;
}

/** The latest arrivals marked LATE on one work date, the most minutes first (the "Perlu perhatian" list). */
export async function listTodayLate(
  orgId: number,
  workDate: string,
  limit: number,
  scope: DashboardScope = {},
): Promise<TodayLateRow[]> {
  const params: unknown[] = [orgId, workDate];
  let where = '';
  if (scope.managerId !== undefined) {
    params.push(scope.managerId);
    where = ` AND u.manager_id = $${params.length}`;
  }
  params.push(limit);
  const rows = await sql.query(
    `SELECT a.user_id AS "userId", u.name, a.late_minutes AS "lateMinutes", b.name AS "branchName"
       FROM attendance_logs a
       JOIN users u ON u.id = a.user_id AND u.org_id = a.org_id
       LEFT JOIN branches b ON b.id = a.check_in_branch_id AND b.org_id = a.org_id
      WHERE a.org_id = $1 AND a.work_date = $2::date AND a.status = 'LATE'${where}
      ORDER BY a.late_minutes DESC, a.id DESC
      LIMIT $${params.length}`,
    params,
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    userId: Number(r.userId),
    name: String(r.name),
    lateMinutes: Number(r.lateMinutes ?? 0),
    branchName: r.branchName === null || r.branchName === undefined ? null : String(r.branchName),
  }));
}

export interface PendingRequestsSummary {
  count: number;
  /** Whole days the oldest pending request has waited (0 = today); null when nothing is pending. */
  oldestDays: number | null;
}

/** Requests waiting for a decision, with the same scope the approval inbox (/app/requests) applies. */
export async function getPendingRequestsSummary(orgId: number, scope: DashboardScope = {}): Promise<PendingRequestsSummary> {
  const params: unknown[] = [orgId];
  let join = '';
  let where = '';
  if (scope.managerId !== undefined) {
    params.push(scope.managerId);
    join = 'JOIN users u ON u.id = r.user_id AND u.org_id = r.org_id';
    where = ` AND u.manager_id = $${params.length}`;
  }
  const rows = await sql.query(
    `SELECT count(*)::int AS n,
            floor(extract(epoch FROM (now() - min(r.created_at))) / 86400)::int AS "oldestDays"
       FROM attendance_requests r
       ${join}
      WHERE r.org_id = $1 AND r.status = 'PENDING'${where}`,
    params,
  );
  const r = rows[0] as { n: number; oldestDays: number | null } | undefined;
  const count = Number(r?.n ?? 0);
  return { count, oldestDays: count > 0 && r?.oldestDays !== null && r?.oldestDays !== undefined ? Number(r.oldestDays) : null };
}

export interface SetupProgress {
  branches: number;
  shifts: number;
  /** Active people who have a shift (the only ones who can check in). */
  trackedPeople: number;
  /** The signed-in person has at least one attendance row. */
  hasOwnCheckIn: boolean;
}

/** The four "Mulai di sini" steps of an organization that has nothing to show yet. */
export async function getSetupProgress(orgId: number, userId: number): Promise<SetupProgress> {
  const rows = await sql.query(
    `SELECT (SELECT count(*) FROM branches WHERE org_id = $1 AND is_active = TRUE)::int AS branches,
            (SELECT count(*) FROM shifts WHERE org_id = $1 AND is_active = TRUE)::int AS shifts,
            (SELECT count(*) FROM users WHERE org_id = $1 AND status = 'ACTIVE' AND shift_id IS NOT NULL)::int AS "trackedPeople",
            EXISTS (SELECT 1 FROM attendance_logs WHERE org_id = $1 AND user_id = $2) AS "hasOwnCheckIn"`,
    [orgId, userId],
  );
  const r = rows[0] as Record<string, unknown>;
  return {
    branches: Number(r.branches),
    shifts: Number(r.shifts),
    trackedPeople: Number(r.trackedPeople),
    hasOwnCheckIn: Boolean(r.hasOwnCheckIn),
  };
}
