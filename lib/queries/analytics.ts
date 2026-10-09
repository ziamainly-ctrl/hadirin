import { sql } from '../db';
import type { LeaderboardSource } from '../insights/leaderboard';
import type { HourBucket, WeekdayRow } from '../insights/statistics';
import type { AttendanceScope } from './calendar';

// Read-only aggregates for /app/peringkat and /app/statistik. Same rules as calendar.ts: every
// statement starts at org_id = $1, scope predicates join users with org_id = a.org_id, dates and
// counts are cast in SQL (::text / ::int) so nothing depends on how the driver parses them.

/**
 * One row per ACTIVE, tracked employee (`shift_id IS NOT NULL`, ERD.md §1.1) with the statuses
 * of the month in work_date order, comma separated. People with no rows in the month still
 * appear (empty list) so the board can say "belum cukup data" instead of silently dropping them.
 * `monthStart` is the first day of the month, "YYYY-MM-01".
 */
export async function getLeaderboardSources(
  orgId: number,
  monthStart: string,
  scope: AttendanceScope = {},
): Promise<LeaderboardSource[]> {
  const params: unknown[] = [orgId, monthStart];
  const conditions = [`u.org_id = $1`, `u.status = 'ACTIVE'`, `u.shift_id IS NOT NULL`];
  if (scope.branchId !== undefined) {
    params.push(scope.branchId);
    conditions.push(`u.branch_id = $${params.length}`);
  }
  if (scope.managerId !== undefined) {
    params.push(scope.managerId);
    conditions.push(`u.manager_id = $${params.length}`);
  }
  const rows = await sql.query(
    `SELECT u.id AS "userId", u.name, hb.name AS "branchName",
            COALESCE(string_agg(a.status, ',' ORDER BY a.work_date) FILTER (WHERE a.id IS NOT NULL), '') AS statuses
       FROM users u
       LEFT JOIN branches hb ON hb.id = u.branch_id AND hb.org_id = u.org_id
       LEFT JOIN attendance_logs a
              ON a.user_id = u.id AND a.org_id = u.org_id
             AND a.work_date >= $2::date AND a.work_date < ($2::date + interval '1 month')
      WHERE ${conditions.join(' AND ')}
      GROUP BY u.id, u.name, hb.name
      ORDER BY u.name`,
    params,
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    userId: Number(r.userId),
    name: String(r.name),
    branchName: r.branchName === null || r.branchName === undefined ? null : String(r.branchName),
    statuses: String(r.statuses ?? ''),
  }));
}

/**
 * Check-ins per local hour of day in [from, to] (by work_date). The hour is read in the
 * organization's time zone, bound as a parameter, never interpolated.
 */
export async function getCheckInHourCounts(
  orgId: number,
  from: string,
  to: string,
  timeZone: string,
  scope: AttendanceScope = {},
): Promise<HourBucket[]> {
  const params: unknown[] = [orgId, from, to, timeZone];
  const parts: string[] = [];
  if (scope.branchId !== undefined) {
    params.push(scope.branchId);
    parts.push(`u.branch_id = $${params.length}`);
  }
  if (scope.managerId !== undefined) {
    params.push(scope.managerId);
    parts.push(`u.manager_id = $${params.length}`);
  }
  const join = parts.length > 0 ? 'JOIN users u ON u.id = a.user_id AND u.org_id = a.org_id' : '';
  const where = parts.length > 0 ? ` AND ${parts.join(' AND ')}` : '';
  const rows = await sql.query(
    `SELECT EXTRACT(HOUR FROM (a.check_in_at AT TIME ZONE $4::text))::int AS hour, count(*)::int AS count
       FROM attendance_logs a
       ${join}
      WHERE a.org_id = $1 AND a.work_date >= $2::date AND a.work_date <= $3::date
        AND a.check_in_at IS NOT NULL${where}
      GROUP BY 1
      ORDER BY 1`,
    params,
  );
  return (rows as Record<string, unknown>[]).map((r) => ({ hour: Number(r.hour), count: Number(r.count) }));
}

/** Attendance per ISO weekday in [from, to]: attended, late, absent and the distinct dates seen. */
export async function getWeekdayCounts(
  orgId: number,
  from: string,
  to: string,
  scope: AttendanceScope = {},
): Promise<WeekdayRow[]> {
  const params: unknown[] = [orgId, from, to];
  const parts: string[] = [];
  if (scope.branchId !== undefined) {
    params.push(scope.branchId);
    parts.push(`u.branch_id = $${params.length}`);
  }
  if (scope.managerId !== undefined) {
    params.push(scope.managerId);
    parts.push(`u.manager_id = $${params.length}`);
  }
  const join = parts.length > 0 ? 'JOIN users u ON u.id = a.user_id AND u.org_id = a.org_id' : '';
  const where = parts.length > 0 ? ` AND ${parts.join(' AND ')}` : '';
  const rows = await sql.query(
    `SELECT EXTRACT(ISODOW FROM a.work_date)::int AS dow,
            count(*) FILTER (WHERE a.status IN ('PRESENT','LATE'))::int AS attended,
            count(*) FILTER (WHERE a.status = 'LATE')::int AS late,
            count(*) FILTER (WHERE a.status = 'ABSENT')::int AS absent,
            count(DISTINCT a.work_date) FILTER (WHERE a.status IN ('PRESENT','LATE','ABSENT'))::int AS days
       FROM attendance_logs a
       ${join}
      WHERE a.org_id = $1 AND a.work_date >= $2::date AND a.work_date <= $3::date${where}
      GROUP BY 1
      ORDER BY 1`,
    params,
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    dow: Number(r.dow),
    attended: Number(r.attended),
    late: Number(r.late),
    absent: Number(r.absent),
    days: Number(r.days),
  }));
}
