import { sql } from '../db';
import type { AttendanceStatus } from '../constants/statuses';
import { LATE_CATEGORY_A_MAX_MIN, LATE_CATEGORY_B_MAX_MIN, NEAR_EDGE_RATIO, WEAK_ACCURACY_M } from '../insights-constants';

// Read-only aggregate queries behind the admin review pages /app/terlambat (late arrivals, early
// leaves, forgotten check-outs), /app/luar-area (location audit) and /app/selfie (selfie gallery).
// Everything here derives from attendance_logs (ERD.md section 3) and joins users/branches; there
// is no cache and no write. Conventions (AGENTS.md domain rules #1, #3, #7):
//  - every statement starts at `a.org_id = $1` and every join to users/branches repeats the org;
//  - MANAGER scope is `u.manager_id = $n` (direct reports only), OWNER/ADMIN pass no managerId;
//  - dates leave SQL as "YYYY-MM-DD" text and instants as ISO-8601 UTC text, so no driver type
//    parser (Date objects, bigint strings) can change what the pages receive;
//  - lists never return Blob URLs, only a `hasPhoto` boolean: the selfie itself is fetched through
//    /api/files/attendance-logs/{id}/{check-in|check-out}, which re-checks role and tenant.

/** timestamptz as ISO-8601 UTC text, immune to driver Date handling. */
const iso = (column: string) => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

export interface InsightRange {
  from: string;
  to: string;
}

export interface InsightScope {
  /** Check-in branch (an event's own branch), not the employee's home branch. */
  branchId?: number;
  /** MANAGER: only this manager's direct reports. */
  managerId?: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
}

/**
 * The shared WHERE for a log-level query over attendance_logs `a` joined to users `u`:
 * org, date window, optional branch (`branchColumn` is always one of our own literals, never
 * input) and optional manager scope. Params are positional: $1 org, $2 from, $3 to, then branch,
 * then manager.
 */
function logFilter(orgId: number, range: InsightRange, scope: InsightScope, branchColumn: string) {
  const params: unknown[] = [orgId, range.from, range.to];
  const conditions = ['a.org_id = $1', 'a.work_date >= $2::date', 'a.work_date <= $3::date'];
  if (scope.branchId !== undefined) {
    params.push(scope.branchId);
    conditions.push(`${branchColumn} = $${params.length}`);
  }
  if (scope.managerId !== undefined) {
    params.push(scope.managerId);
    conditions.push(`u.manager_id = $${params.length}`);
  }
  return { params, where: conditions.join(' AND ') };
}

const USER_JOIN = 'JOIN users u ON u.id = a.user_id AND u.org_id = a.org_id';

// ---------------------------------------------------------------------------------------------
// Late arrivals
// ---------------------------------------------------------------------------------------------

export interface LateEmployeeRow {
  userId: number;
  name: string;
  employeeCode: string | null;
  branchName: string | null;
  lateCount: number;
  totalLateMinutes: number;
  avgLateMinutes: number;
  maxLateMinutes: number;
  catA: number;
  catB: number;
  catC: number;
  /** Days with a check-in (PRESENT or LATE) in the same window: the denominator of the late share. */
  attendedDays: number;
}

/**
 * One row per employee with at least one LATE log in the window, worst total first. status LATE is
 * only set beyond the shift's tolerance, and late_minutes counts from the scheduled start (ERD
 * section 3.2), so the totals here are the same numbers /app/attendance and the monthly recap show.
 */
export async function getLateSummaryByEmployee(
  orgId: number,
  range: InsightRange,
  scope: InsightScope,
): Promise<LateEmployeeRow[]> {
  const { params, where } = logFilter(orgId, range, scope, 'a.check_in_branch_id');
  params.push(LATE_CATEGORY_A_MAX_MIN, LATE_CATEGORY_B_MAX_MIN);
  const aIdx = params.length - 1;
  const bIdx = params.length;
  const rows = await sql.query(
    `SELECT u.id AS "userId", u.name, u.employee_code AS "employeeCode", hb.name AS "branchName",
            count(*) FILTER (WHERE a.status = 'LATE')::int AS "lateCount",
            COALESCE(sum(a.late_minutes) FILTER (WHERE a.status = 'LATE'), 0)::int AS "totalLateMinutes",
            COALESCE(round(avg(a.late_minutes) FILTER (WHERE a.status = 'LATE')), 0)::int AS "avgLateMinutes",
            COALESCE(max(a.late_minutes) FILTER (WHERE a.status = 'LATE'), 0)::int AS "maxLateMinutes",
            count(*) FILTER (WHERE a.status = 'LATE' AND a.late_minutes <= $${aIdx})::int AS "catA",
            count(*) FILTER (WHERE a.status = 'LATE' AND a.late_minutes > $${aIdx} AND a.late_minutes <= $${bIdx})::int AS "catB",
            count(*) FILTER (WHERE a.status = 'LATE' AND a.late_minutes > $${bIdx})::int AS "catC",
            count(*) FILTER (WHERE a.status IN ('PRESENT', 'LATE'))::int AS "attendedDays"
       FROM attendance_logs a
       ${USER_JOIN}
       LEFT JOIN branches hb ON hb.id = u.branch_id AND hb.org_id = a.org_id
      WHERE ${where}
      GROUP BY u.id, u.name, u.employee_code, hb.name
     HAVING count(*) FILTER (WHERE a.status = 'LATE') > 0
      ORDER BY "totalLateMinutes" DESC, "lateCount" DESC, u.name
      LIMIT 1000`,
    params,
  );
  return rows as LateEmployeeRow[];
}

export interface LateTotals {
  lateCount: number;
  employees: number;
  totalLateMinutes: number;
  avgLateMinutes: number;
  catC: number;
  attendedDays: number;
}

/** Window totals for the tiles (one pass over the same rows, so the tiles always match the list). */
export async function getLateTotals(orgId: number, range: InsightRange, scope: InsightScope): Promise<LateTotals> {
  const { params, where } = logFilter(orgId, range, scope, 'a.check_in_branch_id');
  params.push(LATE_CATEGORY_B_MAX_MIN);
  const rows = await sql.query(
    `SELECT count(*) FILTER (WHERE a.status = 'LATE')::int AS "lateCount",
            count(DISTINCT a.user_id) FILTER (WHERE a.status = 'LATE')::int AS employees,
            COALESCE(sum(a.late_minutes) FILTER (WHERE a.status = 'LATE'), 0)::int AS "totalLateMinutes",
            COALESCE(round(avg(a.late_minutes) FILTER (WHERE a.status = 'LATE')), 0)::int AS "avgLateMinutes",
            count(*) FILTER (WHERE a.status = 'LATE' AND a.late_minutes > $${params.length})::int AS "catC",
            count(*) FILTER (WHERE a.status IN ('PRESENT', 'LATE'))::int AS "attendedDays"
       FROM attendance_logs a
       ${USER_JOIN}
      WHERE ${where}`,
    params,
  );
  return rows[0] as LateTotals;
}

export interface LateLogRow {
  logId: number;
  userId: number;
  name: string;
  workDate: string;
  scheduledIn: string | null;
  checkInAt: string;
  lateMinutes: number;
  branchName: string | null;
  isOutside: boolean;
  hasPhoto: boolean;
}

/** Every LATE log in the window, newest first (the "Rincian" tab), offset-paginated. */
export async function listLateLogs(
  orgId: number,
  range: InsightRange,
  scope: InsightScope,
  page: number,
  pageSize: number,
): Promise<Paged<LateLogRow>> {
  const { params, where } = logFilter(orgId, range, scope, 'a.check_in_branch_id');
  const condition = `${where} AND a.status = 'LATE' AND a.check_in_at IS NOT NULL`;
  const countRows = await sql.query(
    `SELECT count(*)::int AS n FROM attendance_logs a ${USER_JOIN} WHERE ${condition}`,
    params,
  );
  const total = (countRows[0] as { n: number }).n;
  const rows = await sql.query(
    `SELECT a.id AS "logId", a.user_id AS "userId", u.name, a.work_date::text AS "workDate",
            a.scheduled_in::text AS "scheduledIn", ${iso('a.check_in_at')} AS "checkInAt",
            a.late_minutes AS "lateMinutes", b.name AS "branchName",
            a.check_in_is_outside AS "isOutside", (a.check_in_photo_url IS NOT NULL) AS "hasPhoto"
       FROM attendance_logs a
       ${USER_JOIN}
       LEFT JOIN branches b ON b.id = a.check_in_branch_id AND b.org_id = a.org_id
      WHERE ${condition}
      ORDER BY a.work_date DESC, a.late_minutes DESC, a.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { rows: rows as LateLogRow[], total };
}

export interface EarlyLeaveLogRow {
  logId: number;
  userId: number;
  name: string;
  workDate: string;
  scheduledOut: string | null;
  checkOutAt: string;
  earlyLeaveMinutes: number;
  branchName: string | null;
  hasPhoto: boolean;
}

export interface EarlyLeaveTotals {
  count: number;
  employees: number;
  totalMinutes: number;
  avgMinutes: number;
}

/** Window totals for logs closed before the scheduled end (early_leave_minutes > 0). */
export async function getEarlyLeaveTotals(orgId: number, range: InsightRange, scope: InsightScope): Promise<EarlyLeaveTotals> {
  const { params, where } = logFilter(orgId, range, scope, 'a.check_out_branch_id');
  const rows = await sql.query(
    `SELECT count(*)::int AS count, count(DISTINCT a.user_id)::int AS employees,
            COALESCE(sum(a.early_leave_minutes), 0)::int AS "totalMinutes",
            COALESCE(round(avg(a.early_leave_minutes)), 0)::int AS "avgMinutes"
       FROM attendance_logs a
       ${USER_JOIN}
      WHERE ${where} AND a.check_out_at IS NOT NULL AND a.early_leave_minutes > 0`,
    params,
  );
  return rows[0] as EarlyLeaveTotals;
}

/** Logs closed before the scheduled end, longest early leave first within a day. */
export async function listEarlyLeaveLogs(
  orgId: number,
  range: InsightRange,
  scope: InsightScope,
  page: number,
  pageSize: number,
): Promise<Paged<EarlyLeaveLogRow>> {
  const { params, where } = logFilter(orgId, range, scope, 'a.check_out_branch_id');
  const condition = `${where} AND a.check_out_at IS NOT NULL AND a.early_leave_minutes > 0`;
  const countRows = await sql.query(
    `SELECT count(*)::int AS n FROM attendance_logs a ${USER_JOIN} WHERE ${condition}`,
    params,
  );
  const total = (countRows[0] as { n: number }).n;
  const rows = await sql.query(
    `SELECT a.id AS "logId", a.user_id AS "userId", u.name, a.work_date::text AS "workDate",
            a.scheduled_out::text AS "scheduledOut", ${iso('a.check_out_at')} AS "checkOutAt",
            a.early_leave_minutes AS "earlyLeaveMinutes", b.name AS "branchName",
            (a.check_out_photo_url IS NOT NULL) AS "hasPhoto"
       FROM attendance_logs a
       ${USER_JOIN}
       LEFT JOIN branches b ON b.id = a.check_out_branch_id AND b.org_id = a.org_id
      WHERE ${condition}
      ORDER BY a.work_date DESC, a.early_leave_minutes DESC, a.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { rows: rows as EarlyLeaveLogRow[], total };
}

export interface ForgottenCheckoutRow {
  logId: number;
  userId: number;
  name: string;
  workDate: string;
  scheduledOut: string | null;
  checkInAt: string;
  branchName: string | null;
  status: AttendanceStatus;
  hasPhoto: boolean;
}

/**
 * Open logs (checked in, never checked out) for a day that is over: work_date before today in the
 * org's own calendar. A cross-day shift that is still legitimately running (yesterday's date, and
 * the local clock has not reached its scheduled end yet) is excluded, matching the close-day rule
 * "a night shift still running is never marked missing" (ERD.md section 3.2). Uses idx_att_open.
 */
function forgottenCondition(where: string, paramCount: number): string {
  const todayIdx = paramCount + 1;
  const tzIdx = paramCount + 2;
  return `${where}
        AND a.check_in_at IS NOT NULL AND a.check_out_at IS NULL
        AND a.work_date < $${todayIdx}::date
        AND NOT (
          COALESCE(a.scheduled_out < a.scheduled_in, FALSE)
          AND a.work_date = ($${todayIdx}::date - 1)
          AND (now() AT TIME ZONE $${tzIdx}::text)::time < a.scheduled_out
        )`;
}

export async function listForgottenCheckouts(
  orgId: number,
  range: InsightRange,
  scope: InsightScope,
  clock: { today: string; timeZone: string },
  page: number,
  pageSize: number,
): Promise<Paged<ForgottenCheckoutRow>> {
  const { params, where } = logFilter(orgId, range, scope, 'a.check_in_branch_id');
  const condition = forgottenCondition(where, params.length);
  const withClock = [...params, clock.today, clock.timeZone];
  const countRows = await sql.query(
    `SELECT count(*)::int AS n FROM attendance_logs a ${USER_JOIN} WHERE ${condition}`,
    withClock,
  );
  const total = (countRows[0] as { n: number }).n;
  const rows = await sql.query(
    `SELECT a.id AS "logId", a.user_id AS "userId", u.name, a.work_date::text AS "workDate",
            a.scheduled_out::text AS "scheduledOut", ${iso('a.check_in_at')} AS "checkInAt",
            b.name AS "branchName", a.status, (a.check_in_photo_url IS NOT NULL) AS "hasPhoto"
       FROM attendance_logs a
       ${USER_JOIN}
       LEFT JOIN branches b ON b.id = a.check_in_branch_id AND b.org_id = a.org_id
      WHERE ${condition}
      ORDER BY a.work_date DESC, a.id DESC
      LIMIT $${withClock.length + 1} OFFSET $${withClock.length + 2}`,
    [...withClock, pageSize, (page - 1) * pageSize],
  );
  return { rows: rows as ForgottenCheckoutRow[], total };
}

export interface ForgottenCheckoutTotals {
  count: number;
  employees: number;
  /** Oldest affected work date, "YYYY-MM-DD", or null when there is none. */
  oldestDate: string | null;
}

export async function getForgottenCheckoutTotals(
  orgId: number,
  range: InsightRange,
  scope: InsightScope,
  clock: { today: string; timeZone: string },
): Promise<ForgottenCheckoutTotals> {
  const { params, where } = logFilter(orgId, range, scope, 'a.check_in_branch_id');
  const condition = forgottenCondition(where, params.length);
  const rows = await sql.query(
    `SELECT count(*)::int AS count, count(DISTINCT a.user_id)::int AS employees, min(a.work_date)::text AS "oldestDate"
       FROM attendance_logs a
       ${USER_JOIN}
      WHERE ${condition}`,
    [...params, clock.today, clock.timeZone],
  );
  return rows[0] as ForgottenCheckoutTotals;
}

// ---------------------------------------------------------------------------------------------
// Location audit (outside the geofence / weak GPS / near the edge)
// ---------------------------------------------------------------------------------------------

export const LOCATION_KINDS = ['outside', 'weak', 'edge'] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export type PunchKind = 'IN' | 'OUT';

export interface LocationEventRow {
  logId: number;
  userId: number;
  name: string;
  kind: PunchKind;
  workDate: string;
  at: string;
  branchName: string | null;
  /** The branch's current radius (not a snapshot: editing a branch changes it for old rows). */
  radiusM: number | null;
  distanceM: number | null;
  accuracyM: number | null;
  lat: number | null;
  lng: number | null;
  isOutside: boolean;
  hasPhoto: boolean;
}

/** Whitelist: the SQL for each audit kind, selected by a validated enum, never by raw input. */
const LOCATION_KIND_SQL: Record<LocationKind, string> = {
  outside: 'ev.is_outside',
  weak: `ev.accuracy_m > ${WEAK_ACCURACY_M}`,
  edge: `(NOT ev.is_outside AND b.radius_m > 0 AND ev.distance_m >= b.radius_m * ${NEAR_EDGE_RATIO})`,
};

/**
 * Both punches of every log in the window as one event list (check-in and check-out each carry
 * their own location), so a person who checked in inside and out outside shows up once, as the
 * check-out. The branch filter applies to each event's own branch column.
 */
function locationEvents(orgId: number, range: InsightRange, scope: InsightScope) {
  const inPart = logFilter(orgId, range, scope, 'a.check_in_branch_id');
  const outWhere = scope.branchId !== undefined ? inPart.where.replace('a.check_in_branch_id', 'a.check_out_branch_id') : inPart.where;
  const cte = `WITH ev AS (
      SELECT a.id AS log_id, a.user_id, u.name, 'IN'::text AS kind, a.work_date, a.check_in_at AS at,
             a.check_in_branch_id AS branch_id, a.check_in_lat AS lat, a.check_in_lng AS lng,
             a.check_in_accuracy_m AS accuracy_m, a.check_in_distance_m AS distance_m,
             a.check_in_is_outside AS is_outside, (a.check_in_photo_url IS NOT NULL) AS has_photo
        FROM attendance_logs a ${USER_JOIN}
       WHERE ${inPart.where} AND a.check_in_at IS NOT NULL
      UNION ALL
      SELECT a.id, a.user_id, u.name, 'OUT'::text, a.work_date, a.check_out_at,
             a.check_out_branch_id, a.check_out_lat, a.check_out_lng,
             a.check_out_accuracy_m, a.check_out_distance_m,
             a.check_out_is_outside, (a.check_out_photo_url IS NOT NULL)
        FROM attendance_logs a ${USER_JOIN}
       WHERE ${outWhere} AND a.check_out_at IS NOT NULL
    )`;
  return { cte, params: inPart.params };
}

export interface LocationAuditCounts {
  outside: number;
  outsideEmployees: number;
  weak: number;
  edge: number;
  avgOutsideM: number;
  maxOutsideM: number;
  events: number;
}

/** Counts per audit kind (tab badges and tiles) over the same window as the list. */
export async function getLocationAuditCounts(
  orgId: number,
  range: InsightRange,
  scope: InsightScope,
): Promise<LocationAuditCounts> {
  const { cte, params } = locationEvents(orgId, range, scope);
  const rows = await sql.query(
    `${cte}
     SELECT count(*) FILTER (WHERE ${LOCATION_KIND_SQL.outside})::int AS outside,
            count(DISTINCT ev.user_id) FILTER (WHERE ${LOCATION_KIND_SQL.outside})::int AS "outsideEmployees",
            count(*) FILTER (WHERE ${LOCATION_KIND_SQL.weak})::int AS weak,
            count(*) FILTER (WHERE ${LOCATION_KIND_SQL.edge})::int AS edge,
            COALESCE(round(avg(ev.distance_m) FILTER (WHERE ${LOCATION_KIND_SQL.outside})), 0)::int AS "avgOutsideM",
            COALESCE(max(ev.distance_m) FILTER (WHERE ${LOCATION_KIND_SQL.outside}), 0)::int AS "maxOutsideM",
            count(*)::int AS events
       FROM ev
       LEFT JOIN branches b ON b.id = ev.branch_id AND b.org_id = $1`,
    params,
  );
  return rows[0] as LocationAuditCounts;
}

interface RawLocationEvent extends Omit<LocationEventRow, 'lat' | 'lng'> {
  lat: string | number | null;
  lng: string | number | null;
}

export async function listLocationEvents(
  orgId: number,
  range: InsightRange,
  scope: InsightScope,
  kind: LocationKind,
  page: number,
  pageSize: number,
): Promise<Paged<LocationEventRow>> {
  const { cte, params } = locationEvents(orgId, range, scope);
  const kindSql = LOCATION_KIND_SQL[kind];
  const countRows = await sql.query(
    `${cte}
     SELECT count(*)::int AS n FROM ev LEFT JOIN branches b ON b.id = ev.branch_id AND b.org_id = $1 WHERE ${kindSql}`,
    params,
  );
  const total = (countRows[0] as { n: number }).n;
  const rows = await sql.query(
    `${cte}
     SELECT ev.log_id AS "logId", ev.user_id AS "userId", ev.name, ev.kind, ev.work_date::text AS "workDate",
            ${iso('ev.at')} AS at, b.name AS "branchName", b.radius_m AS "radiusM",
            ev.distance_m AS "distanceM", ev.accuracy_m AS "accuracyM", ev.lat, ev.lng,
            ev.is_outside AS "isOutside", ev.has_photo AS "hasPhoto"
       FROM ev
       LEFT JOIN branches b ON b.id = ev.branch_id AND b.org_id = $1
      WHERE ${kindSql}
      ORDER BY ev.at DESC, ev.log_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return {
    rows: (rows as RawLocationEvent[]).map((row) => ({
      ...row,
      // NUMERIC(9,6) comes back as text.
      lat: row.lat === null ? null : Number(row.lat),
      lng: row.lng === null ? null : Number(row.lng),
    })),
    total,
  };
}

// ---------------------------------------------------------------------------------------------
// Selfie gallery
// ---------------------------------------------------------------------------------------------

export const SELFIE_PUNCHES = ['all', 'in', 'out'] as const;
export type SelfiePunch = (typeof SELFIE_PUNCHES)[number];
export const SELFIE_FLAGS = ['all', 'late', 'outside'] as const;
export type SelfieFlag = (typeof SELFIE_FLAGS)[number];

export interface SelfieFilter {
  punch: SelfiePunch;
  flag: SelfieFlag;
}

export interface SelfieItem {
  logId: number;
  userId: number;
  name: string;
  kind: PunchKind;
  workDate: string;
  at: string;
  branchName: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  isOutside: boolean;
  distanceM: number | null;
  accuracyM: number | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
}

interface RawSelfieItem extends Omit<SelfieItem, 'lat' | 'lng'> {
  lat: string | number | null;
  lng: string | number | null;
}

/**
 * Photo events of the window. Only the punches that have a photo are listed, and the row carries no
 * URL at all: the page builds /api/files/attendance-logs/{logId}/{check-in|check-out} from
 * (logId, kind). The `late` flag applies to check-ins only (a log's LATE status is about arriving).
 */
function selfieEvents(orgId: number, range: InsightRange, scope: InsightScope, filter: SelfieFilter) {
  const inPart = logFilter(orgId, range, scope, 'a.check_in_branch_id');
  const outWhere = scope.branchId !== undefined ? inPart.where.replace('a.check_in_branch_id', 'a.check_out_branch_id') : inPart.where;

  // Every branch of the UNION aliases all columns, so the CTE's column names never depend on which
  // branch happens to come first.
  const inSelect = (extra: string) => `SELECT a.id AS log_id, a.user_id AS user_id, u.name AS name, 'IN'::text AS kind,
             a.work_date AS work_date, a.check_in_at AS at, a.check_in_branch_id AS branch_id, a.status AS status,
             a.late_minutes AS late_minutes, 0 AS early_leave_minutes, a.check_in_is_outside AS is_outside,
             a.check_in_distance_m AS distance_m, a.check_in_accuracy_m AS accuracy_m,
             a.check_in_lat AS lat, a.check_in_lng AS lng, a.note AS note
        FROM attendance_logs a ${USER_JOIN}
       WHERE ${inPart.where} AND a.check_in_at IS NOT NULL AND a.check_in_photo_url IS NOT NULL${extra}`;
  const outSelect = (extra: string) => `SELECT a.id AS log_id, a.user_id AS user_id, u.name AS name, 'OUT'::text AS kind,
             a.work_date AS work_date, a.check_out_at AS at, a.check_out_branch_id AS branch_id, a.status AS status,
             0 AS late_minutes, a.early_leave_minutes AS early_leave_minutes, a.check_out_is_outside AS is_outside,
             a.check_out_distance_m AS distance_m, a.check_out_accuracy_m AS accuracy_m,
             a.check_out_lat AS lat, a.check_out_lng AS lng, a.note AS note
        FROM attendance_logs a ${USER_JOIN}
       WHERE ${outWhere} AND a.check_out_at IS NOT NULL AND a.check_out_photo_url IS NOT NULL${extra}`;

  const parts: string[] = [];
  if (filter.punch !== 'out') {
    parts.push(inSelect(filter.flag === 'late' ? " AND a.status = 'LATE'" : filter.flag === 'outside' ? ' AND a.check_in_is_outside' : ''));
  }
  if (filter.punch !== 'in' && filter.flag !== 'late') {
    parts.push(outSelect(filter.flag === 'outside' ? ' AND a.check_out_is_outside' : ''));
  }
  // "Terlambat" only describes arriving, so late + check-out selects nothing: keep the CTE valid
  // with an always-empty branch.
  if (parts.length === 0) parts.push(inSelect(' AND FALSE'));
  return { cte: `WITH ev AS (${parts.join('\n      UNION ALL\n      ')})`, params: inPart.params };
}

export interface SelfieSummary {
  photos: number;
  employees: number;
  late: number;
  outside: number;
}

export async function getSelfieSummary(
  orgId: number,
  range: InsightRange,
  scope: InsightScope,
  filter: SelfieFilter,
): Promise<SelfieSummary> {
  const { cte, params } = selfieEvents(orgId, range, scope, filter);
  const rows = await sql.query(
    `${cte}
     SELECT count(*)::int AS photos, count(DISTINCT ev.user_id)::int AS employees,
            count(*) FILTER (WHERE ev.kind = 'IN' AND ev.status = 'LATE')::int AS late,
            count(*) FILTER (WHERE ev.is_outside)::int AS outside
       FROM ev`,
    params,
  );
  return rows[0] as SelfieSummary;
}

export async function listSelfies(
  orgId: number,
  range: InsightRange,
  scope: InsightScope,
  filter: SelfieFilter,
  page: number,
  pageSize: number,
): Promise<Paged<SelfieItem>> {
  const { cte, params } = selfieEvents(orgId, range, scope, filter);
  const countRows = await sql.query(`${cte} SELECT count(*)::int AS n FROM ev`, params);
  const total = (countRows[0] as { n: number }).n;
  const rows = await sql.query(
    `${cte}
     SELECT ev.log_id AS "logId", ev.user_id AS "userId", ev.name, ev.kind, ev.work_date::text AS "workDate",
            ${iso('ev.at')} AS at, b.name AS "branchName", ev.status, ev.late_minutes AS "lateMinutes",
            ev.early_leave_minutes AS "earlyLeaveMinutes", ev.is_outside AS "isOutside",
            ev.distance_m AS "distanceM", ev.accuracy_m AS "accuracyM", ev.lat, ev.lng, ev.note
       FROM ev
       LEFT JOIN branches b ON b.id = ev.branch_id AND b.org_id = $1
      ORDER BY ev.at DESC, ev.log_id DESC, ev.kind
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return {
    rows: (rows as RawSelfieItem[]).map((row) => ({
      ...row,
      lat: row.lat === null ? null : Number(row.lat),
      lng: row.lng === null ? null : Number(row.lng),
    })),
    total,
  };
}
