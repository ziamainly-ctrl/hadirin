import { sql } from '../db';

// Read model for /app/riwayat: the signed-in user's own month at a glance. The row list itself
// comes from listAttendanceForOrg(orgId, { userId }) in lib/queries/attendance.ts, so the two
// can never disagree about what a status means. Both userId and orgId come from the session
// (AGENTS.md domain rules #1 and #3); nothing here accepts a person from the request.

export interface MyMonthSummary {
  /** Logs on time (PRESENT). */
  present: number;
  late: number;
  absent: number;
  /** Approved cuti, sakit or izin days. */
  away: number;
  lateMinutes: number;
  workMinutes: number;
}

/** `monthStart` is the first day of the month as "YYYY-MM-01" (org-local). */
export async function getMyMonthSummary(orgId: number, userId: number, monthStart: string): Promise<MyMonthSummary> {
  const rows = await sql.query(
    `SELECT count(*) FILTER (WHERE status = 'PRESENT')::int AS present,
            count(*) FILTER (WHERE status = 'LATE')::int AS late,
            count(*) FILTER (WHERE status = 'ABSENT')::int AS absent,
            count(*) FILTER (WHERE status IN ('LEAVE','SICK','PERMIT'))::int AS away,
            COALESCE(sum(late_minutes), 0)::int AS "lateMinutes",
            COALESCE(sum(work_minutes), 0)::int AS "workMinutes"
       FROM attendance_logs
      WHERE org_id = $1 AND user_id = $2
        AND work_date >= $3::date AND work_date < ($3::date + interval '1 month')`,
    [orgId, userId, monthStart],
  );
  return rows[0] as MyMonthSummary;
}
