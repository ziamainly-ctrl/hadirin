import { sql } from '../db';
import type { AttendanceStatus } from '../constants/statuses';

// Read models for /app/live ("what is happening right now, event by event"). Everything here is
// uncached on purpose: the page polls every 15 s and must show a punch the moment it lands, and
// the dashboard's own 20 s cache (TRD.md §10) is a different payload. Every statement starts at
// `org_id = $1`; MANAGER scoping is `users.manager_id = $managerId`, joined with the org check
// (AGENTS.md domain rules #1 and #7). Dates and instants are bound as parameters, and the org
// time zone is bound as `$n::text` (never interpolated).

/** A check-in or check-out still counts as "on site" only while it is recent enough that the
 * person can plausibly still be at work; an unclosed log from days ago is a forgotten check-out,
 * not presence. Generous enough for a 12 h night shift with overtime. */
const ON_SITE_WINDOW = `interval '18 hours'`;

export interface PunchEvent {
  logId: number;
  userId: number;
  name: string;
  kind: 'IN' | 'OUT';
  /** The instant of the punch (ISO). */
  at: string;
  branchName: string | null;
  isOutside: boolean;
  /** Whether a selfie exists for this punch. The Blob URL itself never leaves the files route. */
  hasPhoto: boolean;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
}

/**
 * Today's punches, newest first, two per log (one IN, one OUT). The window is the org-LOCAL date
 * of the punch, not the log's work_date: a night shift that started yesterday and ended this
 * morning belongs to yesterday's log, but its check-out is today's news. `work_date BETWEEN
 * date-1 AND date` is only the index range that bounds the scan.
 */
export async function listPunchEventsForDay(
  orgId: number,
  workDate: string,
  timeZone: string,
  managerId?: number,
  limit = 60,
): Promise<PunchEvent[]> {
  const params: unknown[] = [orgId, workDate, timeZone, limit];
  let managerJoin = '';
  if (managerId !== undefined) {
    params.push(managerId);
    managerJoin = `JOIN users m ON m.id = a.user_id AND m.org_id = a.org_id AND m.manager_id = $${params.length}`;
  }
  const rows = await sql.query(
    `WITH day_logs AS (
       SELECT a.id, a.user_id, a.status, a.late_minutes, a.early_leave_minutes,
              a.check_in_at, a.check_in_branch_id, a.check_in_is_outside, (a.check_in_photo_url IS NOT NULL) AS in_photo,
              a.check_out_at, a.check_out_branch_id, a.check_out_is_outside, (a.check_out_photo_url IS NOT NULL) AS out_photo
         FROM attendance_logs a ${managerJoin}
        WHERE a.org_id = $1 AND a.work_date BETWEEN ($2::date - 1) AND $2::date
     ), punches AS (
       SELECT id AS log_id, user_id, 'IN'::text AS kind, check_in_at AS at, check_in_branch_id AS branch_id,
              check_in_is_outside AS is_outside, in_photo AS has_photo, status, late_minutes, 0 AS early_leave_minutes
         FROM day_logs
        WHERE check_in_at IS NOT NULL AND (check_in_at AT TIME ZONE $3::text)::date = $2::date
       UNION ALL
       SELECT id, user_id, 'OUT'::text, check_out_at, check_out_branch_id,
              check_out_is_outside, out_photo, status, 0, early_leave_minutes
         FROM day_logs
        WHERE check_out_at IS NOT NULL AND (check_out_at AT TIME ZONE $3::text)::date = $2::date
     )
     SELECT p.log_id AS "logId", p.user_id AS "userId", u.name, p.kind, p.at, b.name AS "branchName",
            p.is_outside AS "isOutside", p.has_photo AS "hasPhoto", p.status,
            p.late_minutes AS "lateMinutes", p.early_leave_minutes AS "earlyLeaveMinutes"
       FROM punches p
       JOIN users u ON u.id = p.user_id AND u.org_id = $1
       LEFT JOIN branches b ON b.id = p.branch_id AND b.org_id = $1
      ORDER BY p.at DESC, p.log_id DESC
      LIMIT $4`,
    params,
  );
  return rows as PunchEvent[];
}

export interface BranchPresence {
  branchId: number;
  name: string;
  /** Checked in here and not checked out yet. */
  onSite: number;
  /** Checked out today. */
  checkedOut: number;
  /** Logs of today's work date marked LATE. */
  late: number;
}

/**
 * Per active branch: who is there now, who left, who was late. Logs are attributed to the branch
 * they CHECKED IN at (check_in_branch_id), the one the geofence matched. Branches with nobody
 * still appear (LEFT JOIN) so an empty branch reads 0 instead of vanishing.
 */
export async function getBranchPresence(
  orgId: number,
  workDate: string,
  timeZone: string,
  managerId?: number,
): Promise<BranchPresence[]> {
  const params: unknown[] = [orgId, workDate, timeZone];
  let managerFilter = '';
  if (managerId !== undefined) {
    params.push(managerId);
    managerFilter = `AND EXISTS (SELECT 1 FROM users m WHERE m.id = a.user_id AND m.org_id = a.org_id AND m.manager_id = $${params.length})`;
  }
  const rows = await sql.query(
    `SELECT b.id AS "branchId", b.name,
            count(a.id) FILTER (WHERE a.check_in_at IS NOT NULL AND a.check_out_at IS NULL
                                  AND a.check_in_at > now() - ${ON_SITE_WINDOW})::int AS "onSite",
            count(a.id) FILTER (WHERE a.check_out_at IS NOT NULL
                                  AND (a.check_out_at AT TIME ZONE $3::text)::date = $2::date)::int AS "checkedOut",
            count(a.id) FILTER (WHERE a.status = 'LATE' AND a.work_date = $2::date)::int AS late
       FROM branches b
       LEFT JOIN attendance_logs a
              ON a.org_id = b.org_id AND a.check_in_branch_id = b.id
             AND a.work_date BETWEEN ($2::date - 1) AND $2::date
             ${managerFilter}
      WHERE b.org_id = $1 AND b.is_active = TRUE
      GROUP BY b.id, b.name
      ORDER BY b.name`,
    params,
  );
  return rows as BranchPresence[];
}

export interface LiveSummary {
  /** Tracked, active people scheduled to work today (the denominator of "belum hadir"). */
  expected: number;
  /** Scheduled people with no check-in yet and no approved leave / holiday row: still to come. */
  notYetIn: number;
  /** Scheduled people covered by an approved leave, sick, permit or holiday/off row. */
  away: number;
  /** Anyone (scheduled or not) currently checked in and not out. */
  onSite: number;
  /** Anyone who checked out today. */
  checkedOut: number;
  /** Logs of today's work date marked LATE. */
  late: number;
  /** Check-ins today flagged outside the geofence. */
  outside: number;
}

/**
 * The four tiles above the feed. Two small aggregates instead of one join of both: the
 * "expected" side walks users (scheduled today), the "activity" side walks today's logs, and they
 * answer different questions (an owner who checks in on a day off is activity but not expected).
 */
export async function getLiveSummary(
  orgId: number,
  workDate: string,
  timeZone: string,
  managerId?: number,
): Promise<LiveSummary> {
  const expectedParams: unknown[] = [orgId, workDate];
  let expectedManager = '';
  if (managerId !== undefined) {
    expectedParams.push(managerId);
    expectedManager = `AND u.manager_id = $${expectedParams.length}`;
  }
  const activityParams: unknown[] = [orgId, workDate, timeZone];
  let activityJoin = '';
  if (managerId !== undefined) {
    activityParams.push(managerId);
    activityJoin = `JOIN users m ON m.id = a.user_id AND m.org_id = a.org_id AND m.manager_id = $${activityParams.length}`;
  }

  const [expectedRows, activityRows] = await Promise.all([
    sql.query(
      `SELECT count(*)::int AS expected,
              count(*) FILTER (WHERE l.id IS NULL OR (l.check_in_at IS NULL AND l.status = 'ABSENT'))::int AS "notYetIn",
              count(*) FILTER (WHERE l.check_in_at IS NULL AND l.status IN ('LEAVE','SICK','PERMIT','HOLIDAY','OFF'))::int AS away
         FROM users u
         JOIN shifts s ON s.id = u.shift_id AND s.org_id = u.org_id
         LEFT JOIN attendance_logs l ON l.org_id = u.org_id AND l.user_id = u.id AND l.work_date = $2::date
        WHERE u.org_id = $1 AND u.status = 'ACTIVE' AND u.shift_id IS NOT NULL
          AND extract(isodow from $2::date)::text = ANY(string_to_array(s.work_days, ','))
          ${expectedManager}`,
      expectedParams,
    ),
    sql.query(
      `SELECT count(*) FILTER (WHERE a.check_in_at IS NOT NULL AND a.check_out_at IS NULL
                                AND a.check_in_at > now() - ${ON_SITE_WINDOW})::int AS "onSite",
              count(*) FILTER (WHERE a.check_out_at IS NOT NULL
                                AND (a.check_out_at AT TIME ZONE $3::text)::date = $2::date)::int AS "checkedOut",
              count(*) FILTER (WHERE a.status = 'LATE' AND a.work_date = $2::date)::int AS late,
              count(*) FILTER (WHERE a.check_in_is_outside
                                AND (a.check_in_at AT TIME ZONE $3::text)::date = $2::date)::int AS outside
         FROM attendance_logs a ${activityJoin}
        WHERE a.org_id = $1 AND a.work_date BETWEEN ($2::date - 1) AND $2::date`,
      activityParams,
    ),
  ]);

  const e = expectedRows[0] as Pick<LiveSummary, 'expected' | 'notYetIn' | 'away'>;
  const a = activityRows[0] as Pick<LiveSummary, 'onSite' | 'checkedOut' | 'late' | 'outside'>;
  return { ...e, ...a };
}

/**
 * Name of today's holiday (a national one or this org's own), or null. Used only to explain the
 * page ("Hari ini libur: X. Check-in tetap dicatat"); check-in itself never reads this.
 */
export async function getHolidayNameOn(orgId: number, date: string): Promise<string | null> {
  const rows = await sql.query(
    `SELECT name FROM holidays
      WHERE holiday_date = $2::date AND (org_id = $1 OR org_id IS NULL)
      ORDER BY org_id NULLS LAST
      LIMIT 1`,
    [orgId, date],
  );
  return (rows[0] as { name: string } | undefined)?.name ?? null;
}
