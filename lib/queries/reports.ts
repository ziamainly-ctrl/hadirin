import { sql } from '../db';
import type { AttendanceStatus } from '../constants/statuses';

// Shared aggregate behind PRD.md US-05 and TRD.md §13 "Exports": the on-screen monthly recap
// and the XLSX/PDF export both read getMonthlyRecap — there is no separate export-only query.

export interface ReportPeriodFilter {
  /** "YYYY-MM"; format is validated upstream (AGENTS.md: validation lives in lib/validators, not here). */
  month: string;
  /** Filters by the user's home branch (`users.branch_id`), not the check-in branch (ERD.md §3.2). */
  branchId?: number;
}

export interface MonthlyRecapRow {
  userId: number;
  employeeCode: string | null;
  name: string;
  branchName: string | null;
  presentCount: number;
  lateCount: number;
  totalLateMinutes: number;
  absentCount: number;
  leaveCount: number;
  sickCount: number;
  permitCount: number;
  holidayCount: number;
  totalWorkMinutes: number;
}

export interface DailyAttendanceDetailRow {
  userId: number;
  name: string;
  workDate: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  workMinutes: number | null;
}

/**
 * Monthly recap aggregate (PRD.md US-05, TRD.md §13). One row per ACTIVE, tracked user
 * (`shift_id IS NOT NULL`, ERD.md §1.1 "Tracked user") in the org for the given month,
 * optionally scoped to one branch. Feeds both the on-screen recap table and the XLSX/PDF
 * export's "Rekap" sheet — do not write a second query for export. Range-scans
 * `idx_att_org_date_cover` on (org_id, work_date) (ERD.md §3.1).
 */
export async function getMonthlyRecap(orgId: number, filter: ReportPeriodFilter): Promise<MonthlyRecapRow[]> {
  const monthStart = `${filter.month}-01`; // "YYYY-MM" -> first-of-month DATE literal
  const conditions = [`u.org_id = $1`, `u.status = 'ACTIVE'`, `u.shift_id IS NOT NULL`];
  const params: unknown[] = [orgId, monthStart];
  if (filter.branchId !== undefined) {
    params.push(filter.branchId);
    conditions.push(`u.branch_id = $${params.length}`);
  }
  const rows = await sql.query(
    `SELECT
       u.id as "userId",
       u.employee_code as "employeeCode",
       u.name,
       b.name as "branchName",
       count(*) FILTER (WHERE al.status = 'PRESENT')::int as "presentCount",
       count(*) FILTER (WHERE al.status = 'LATE')::int as "lateCount",
       COALESCE(sum(al.late_minutes), 0)::int as "totalLateMinutes",
       count(*) FILTER (WHERE al.status = 'ABSENT')::int as "absentCount",
       count(*) FILTER (WHERE al.status = 'LEAVE')::int as "leaveCount",
       count(*) FILTER (WHERE al.status = 'SICK')::int as "sickCount",
       count(*) FILTER (WHERE al.status = 'PERMIT')::int as "permitCount",
       count(*) FILTER (WHERE al.status = 'HOLIDAY')::int as "holidayCount",
       COALESCE(sum(al.work_minutes), 0)::int as "totalWorkMinutes"
       -- 'OFF' is skipped: the close-day cron never writes it for a tracked user (ERD.md §1.1,
       -- §3.2 "Non-work weekday -> no row"), so it would always be 0 here.
     FROM users u
     LEFT JOIN branches b ON b.id = u.branch_id
     LEFT JOIN attendance_logs al
            ON al.user_id = u.id
           AND al.org_id = $1
           AND al.work_date >= date_trunc('month', $2::date)
           AND al.work_date <  (date_trunc('month', $2::date) + interval '1 month')
     WHERE ${conditions.join(' AND ')}
     GROUP BY u.id, u.employee_code, u.name, b.name
     ORDER BY u.name`,
    params,
  );
  return rows as MonthlyRecapRow[];
}

/**
 * Flat, one-row-per-log listing for the month — the XLSX export's "Detail" sheet (TRD.md §13).
 * Not filtered by user status or tracked flag: a log row is a historical fact even if the user
 * is later deactivated or reassigned (AGENTS.md domain rule #10, "History is a snapshot").
 */
export async function getDailyAttendanceDetail(
  orgId: number,
  filter: ReportPeriodFilter,
): Promise<DailyAttendanceDetailRow[]> {
  const monthStart = `${filter.month}-01`;
  const conditions = [
    `al.org_id = $1`,
    `al.work_date >= date_trunc('month', $2::date)`,
    `al.work_date < (date_trunc('month', $2::date) + interval '1 month')`,
  ];
  const params: unknown[] = [orgId, monthStart];
  if (filter.branchId !== undefined) {
    params.push(filter.branchId);
    conditions.push(`u.branch_id = $${params.length}`);
  }
  const rows = await sql.query(
    `SELECT
       al.user_id as "userId",
       u.name,
       al.work_date as "workDate",
       al.status,
       al.check_in_at as "checkInAt",
       al.check_out_at as "checkOutAt",
       al.late_minutes as "lateMinutes",
       al.work_minutes as "workMinutes"
     FROM attendance_logs al
     JOIN users u ON u.id = al.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY al.work_date, u.name`,
    params,
  );
  return rows as DailyAttendanceDetailRow[];
}
