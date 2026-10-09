import { sql } from '../db';
import type { AttendanceStatus } from '../constants/statuses';
import type { DayCounts } from '../insights/statistics';

// Read-only aggregates behind /app/kalender and the trend part of /app/statistik. Every statement
// starts at `a.org_id = $1`; when a scope (home branch / direct reports) is given it joins users
// with `u.org_id = a.org_id`. Dates leave SQL as text ("YYYY-MM-DD") and timestamps are turned
// into ISO strings here, so callers never see a driver `Date` at server-local midnight.
// Range scans use idx_att_org_date_cover (ERD.md §3.1).

export interface AttendanceScope {
  /** Home branch of the employee (`users.branch_id`), the same meaning as the monthly report. */
  branchId?: number;
  /** MANAGER: direct reports only (`users.manager_id`). Never the manager themself. */
  managerId?: number;
}

function scopeClause(scope: AttendanceScope, params: unknown[]): { join: string; where: string } {
  if (scope.branchId === undefined && scope.managerId === undefined) return { join: '', where: '' };
  const parts: string[] = [];
  if (scope.branchId !== undefined) {
    params.push(scope.branchId);
    parts.push(`u.branch_id = $${params.length}`);
  }
  if (scope.managerId !== undefined) {
    params.push(scope.managerId);
    parts.push(`u.manager_id = $${params.length}`);
  }
  return {
    join: 'JOIN users u ON u.id = a.user_id AND u.org_id = a.org_id',
    where: ` AND ${parts.join(' AND ')}`,
  };
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * One row per date in [from, to] that has at least one attendance row: how many were on time,
 * late, absent, or away (leave / sick / permit). HOLIDAY and OFF rows are not counted anywhere
 * (they are not "people at work"); the holiday itself comes from the holidays table.
 */
export async function getDailyStatusCounts(
  orgId: number,
  from: string,
  to: string,
  scope: AttendanceScope = {},
): Promise<DayCounts[]> {
  const params: unknown[] = [orgId, from, to];
  const { join, where } = scopeClause(scope, params);
  const rows = await sql.query(
    `SELECT a.work_date::text AS "date",
            count(*) FILTER (WHERE a.status = 'PRESENT')::int AS present,
            count(*) FILTER (WHERE a.status = 'LATE')::int AS late,
            count(*) FILTER (WHERE a.status = 'ABSENT')::int AS absent,
            count(*) FILTER (WHERE a.status IN ('LEAVE','SICK','PERMIT'))::int AS away
       FROM attendance_logs a
       ${join}
      WHERE a.org_id = $1 AND a.work_date >= $2::date AND a.work_date <= $3::date${where}
      GROUP BY a.work_date
      ORDER BY a.work_date`,
    params,
  );
  return (rows as DayCounts[]).map((r) => ({
    date: String(r.date),
    present: Number(r.present),
    late: Number(r.late),
    absent: Number(r.absent),
    away: Number(r.away),
  }));
}

export interface DayLogRow {
  logId: number;
  userId: number;
  name: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number | null;
  isOutside: boolean;
  branchName: string | null;
}

export interface DayLogs {
  rows: DayLogRow[];
  /** True when more rows exist than were returned. */
  truncated: boolean;
}

export const DAY_LOG_LIMIT = 300;

/** The recorded rows of one work date, check-in order (people without a check-in last). */
export async function listDayLogs(orgId: number, date: string, scope: AttendanceScope = {}): Promise<DayLogs> {
  const params: unknown[] = [orgId, date];
  // This query always needs users for the name, so the scope only adds predicates.
  const parts: string[] = [];
  if (scope.branchId !== undefined) {
    params.push(scope.branchId);
    parts.push(`u.branch_id = $${params.length}`);
  }
  if (scope.managerId !== undefined) {
    params.push(scope.managerId);
    parts.push(`u.manager_id = $${params.length}`);
  }
  const where = parts.length > 0 ? ` AND ${parts.join(' AND ')}` : '';
  params.push(DAY_LOG_LIMIT + 1);
  const rows = await sql.query(
    `SELECT a.id AS "logId", a.user_id AS "userId", u.name, a.status,
            a.check_in_at AS "checkInAt", a.check_out_at AS "checkOutAt",
            a.late_minutes AS "lateMinutes", a.early_leave_minutes AS "earlyLeaveMinutes",
            a.work_minutes AS "workMinutes",
            (a.check_in_is_outside OR a.check_out_is_outside) AS "isOutside",
            b.name AS "branchName"
       FROM attendance_logs a
       JOIN users u ON u.id = a.user_id AND u.org_id = a.org_id
       LEFT JOIN branches b ON b.id = a.check_in_branch_id AND b.org_id = a.org_id
      WHERE a.org_id = $1 AND a.work_date = $2::date${where}
      ORDER BY a.check_in_at NULLS LAST, u.name
      LIMIT $${params.length}`,
    params,
  );
  const mapped: DayLogRow[] = (rows as Record<string, unknown>[]).map((r) => ({
    logId: Number(r.logId),
    userId: Number(r.userId),
    name: String(r.name),
    status: r.status as AttendanceStatus,
    checkInAt: toIso(r.checkInAt),
    checkOutAt: toIso(r.checkOutAt),
    lateMinutes: Number(r.lateMinutes ?? 0),
    earlyLeaveMinutes: Number(r.earlyLeaveMinutes ?? 0),
    workMinutes: r.workMinutes === null || r.workMinutes === undefined ? null : Number(r.workMinutes),
    isOutside: Boolean(r.isOutside),
    branchName: r.branchName === null || r.branchName === undefined ? null : String(r.branchName),
  }));
  return { rows: mapped.slice(0, DAY_LOG_LIMIT), truncated: mapped.length > DAY_LOG_LIMIT };
}
