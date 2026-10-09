import { sql, type TxClient } from '../db';
import type { AttendanceStatus, AttendanceSource } from '../constants/statuses';

// Security/correctness-critical (AGENTS.md domain rules #1, #4, #5, #6, #9) — written
// directly rather than delegated. Mirrors the exact flow in TRD.md §7 and §12.

// One column list for every query that returns a whole log, so a column added to the table is
// added here once instead of in three copy-pasted SELECTs. `work_date` is cast to text: the
// driver would otherwise hand a DATE back as a JS Date at server-local midnight, which JSON
// serialises a day early on any server east of UTC ("2026-10-07T17:00:00.000Z" for the 8th).
// Numeric lat/lng stay NUMERIC(9,6) strings, as the row interface says.
const LOG_FIELDS: readonly [column: string, alias: string][] = [
  ['id', 'id'],
  ['org_id', 'orgId'],
  ['user_id', 'userId'],
  ['shift_id', 'shiftId'],
  ['request_id', 'requestId'],
  ['work_date::text', 'workDate'],
  ['scheduled_in', 'scheduledIn'],
  ['scheduled_out', 'scheduledOut'],
  ['check_in_at', 'checkInAt'],
  ['check_in_branch_id', 'checkInBranchId'],
  ['check_in_lat', 'checkInLat'],
  ['check_in_lng', 'checkInLng'],
  ['check_in_accuracy_m', 'checkInAccuracyM'],
  ['check_in_distance_m', 'checkInDistanceM'],
  ['check_in_photo_url', 'checkInPhotoUrl'],
  ['check_in_is_outside', 'checkInIsOutside'],
  ['check_out_at', 'checkOutAt'],
  ['check_out_branch_id', 'checkOutBranchId'],
  ['check_out_lat', 'checkOutLat'],
  ['check_out_lng', 'checkOutLng'],
  ['check_out_accuracy_m', 'checkOutAccuracyM'],
  ['check_out_distance_m', 'checkOutDistanceM'],
  ['check_out_photo_url', 'checkOutPhotoUrl'],
  ['check_out_is_outside', 'checkOutIsOutside'],
  ['status', 'status'],
  ['late_minutes', 'lateMinutes'],
  ['early_leave_minutes', 'earlyLeaveMinutes'],
  ['work_minutes', 'workMinutes'],
  ['note', 'note'],
  ['source', 'source'],
  ['created_at', 'createdAt'],
  ['updated_at', 'updatedAt'],
];

/** The explicit column list of a whole log; pass the table alias when the query joins. */
export function logColumns(alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  return LOG_FIELDS.map(([column, alias2]) => `${prefix}${column} as "${alias2}"`).join(', ');
}

const LOG_COLUMNS = logColumns();

export interface AttendanceLogRow {
  id: number;
  orgId: number;
  userId: number;
  shiftId: number | null;
  requestId: number | null;
  workDate: string;
  scheduledIn: string | null;
  scheduledOut: string | null;
  checkInAt: string | null;
  checkInBranchId: number | null;
  checkInLat: string | null;
  checkInLng: string | null;
  checkInAccuracyM: number | null;
  checkInDistanceM: number | null;
  checkInPhotoUrl: string | null;
  checkInIsOutside: boolean;
  checkOutAt: string | null;
  checkOutBranchId: number | null;
  checkOutLat: string | null;
  checkOutLng: string | null;
  checkOutAccuracyM: number | null;
  checkOutDistanceM: number | null;
  checkOutPhotoUrl: string | null;
  checkOutIsOutside: boolean;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number | null;
  note: string | null;
  source: AttendanceSource;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInInput {
  orgId: number;
  userId: number;
  shiftId: number;
  workDate: string;
  scheduledIn: string;
  scheduledOut: string;
  branchId: number;
  lat: number;
  lng: number;
  accuracyM: number;
  distanceM: number;
  photoUrl: string | null;
  isOutside: boolean;
  status: AttendanceStatus;
  lateMinutes: number;
  /** The person's own note, or the "Akurasi GPS rendah" flag for a weak fix (lowAccuracyNote). */
  note?: string | null;
}

/** Idempotent: ON CONFLICT (user_id, work_date) DO NOTHING. Null means already checked in — the
 * route handler then calls getLogByUserAndDate() and returns that row with 200 (TRD.md §7 step i). */
export async function insertCheckIn(input: CheckInInput): Promise<AttendanceLogRow | null> {
  const rows = await sql.query(
    `INSERT INTO attendance_logs (
       org_id, user_id, shift_id, work_date, scheduled_in, scheduled_out,
       check_in_at, check_in_branch_id, check_in_lat, check_in_lng, check_in_accuracy_m,
       check_in_distance_m, check_in_photo_url, check_in_is_outside, status, late_minutes, note, source
     ) VALUES ($1,$2,$3,$4,$5,$6, now(), $7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'APP')
     ON CONFLICT (user_id, work_date) DO NOTHING
     RETURNING ${LOG_COLUMNS}`,
    [
      input.orgId,
      input.userId,
      input.shiftId,
      input.workDate,
      input.scheduledIn,
      input.scheduledOut,
      input.branchId,
      input.lat,
      input.lng,
      input.accuracyM,
      input.distanceM,
      input.photoUrl,
      input.isOutside,
      input.status,
      input.lateMinutes,
      input.note ?? null,
    ],
  );
  return (rows[0] as AttendanceLogRow | undefined) ?? null;
}

export interface CheckOutInput {
  orgId: number;
  /** The open log being closed. Not "today's log": a check-out after midnight, or after a
   * cross-day shift ends, closes the log of the previous work date. */
  logId: number;
  branchId: number;
  lat: number;
  lng: number;
  accuracyM: number;
  distanceM: number;
  photoUrl: string | null;
  isOutside: boolean;
  workMinutes: number;
  earlyLeaveMinutes: number;
}

/** Closes one open log by id. 0 rows (null) means it was closed in the meantime (a double tap, a
 * second device): the route answers 409 ALREADY_CHECKED_OUT. Scoped by org_id as well as id
 * (AGENTS.md domain rule #1). */
export async function updateCheckOutById(input: CheckOutInput): Promise<AttendanceLogRow | null> {
  const rows = await sql.query(
    `UPDATE attendance_logs
        SET check_out_at = now(), check_out_branch_id = $3, check_out_lat = $4, check_out_lng = $5,
            check_out_accuracy_m = $6, check_out_distance_m = $7, check_out_photo_url = $8,
            check_out_is_outside = $9, work_minutes = $10, early_leave_minutes = $11, updated_at = now()
      WHERE id = $1 AND org_id = $2 AND check_in_at IS NOT NULL AND check_out_at IS NULL
      RETURNING ${LOG_COLUMNS}`,
    [
      input.logId,
      input.orgId,
      input.branchId,
      input.lat,
      input.lng,
      input.accuracyM,
      input.distanceM,
      input.photoUrl,
      input.isOutside,
      input.workMinutes,
      input.earlyLeaveMinutes,
    ],
  );
  return (rows[0] as AttendanceLogRow | undefined) ?? null;
}

export interface LogWithOwnerRow extends AttendanceLogRow {
  ownerManagerId: number | null;
}

/** For the file-serving authorization check (TRD.md §15) — any log in this org by id,
 * plus its owner's manager_id so a MANAGER's own-team check doesn't need a second query. */
export async function getLogByIdInOrg(orgId: number, id: number): Promise<LogWithOwnerRow | null> {
  const rows = await sql.query(
    `SELECT ${logColumns('a')}, u.manager_id as "ownerManagerId"
       FROM attendance_logs a
       JOIN users u ON u.id = a.user_id AND u.org_id = a.org_id
      WHERE a.id = $1 AND a.org_id = $2
      LIMIT 1`,
    [id, orgId],
  );
  return (rows[0] as LogWithOwnerRow | undefined) ?? null;
}

export async function getLogByUserAndDate(orgId: number, userId: number, workDate: string): Promise<AttendanceLogRow | null> {
  const rows = await sql.query(
    `SELECT ${LOG_COLUMNS} FROM attendance_logs WHERE org_id = $1 AND user_id = $2 AND work_date = $3 LIMIT 1`,
    [orgId, userId, workDate],
  );
  return (rows[0] as AttendanceLogRow | undefined) ?? null;
}

export async function listHistoryForUser(orgId: number, userId: number, limit = 30): Promise<AttendanceLogRow[]> {
  const rows = await sql.query(
    `SELECT ${LOG_COLUMNS} FROM attendance_logs
      WHERE org_id = $1 AND user_id = $2
      ORDER BY work_date DESC
      LIMIT $3`,
    [orgId, userId, limit],
  );
  return rows as AttendanceLogRow[];
}

export interface ListAttendanceFilter {
  dateFrom?: string;
  dateTo?: string;
  branchId?: number;
  status?: AttendanceStatus;
  userId?: number;
  /** TRD.md §6 "MANAGER (team)" — scopes to this manager's direct reports via a join. */
  managerId?: number;
}

/** Admin attendance table (TRD.md §6 `GET /api/attendance`). Offset pagination — this is a
 * bounded admin list (filtered by date range), not the hot unbounded dashboard path. */
export async function listAttendanceForOrg(
  orgId: number,
  filter: ListAttendanceFilter,
  page: number,
  pageSize: number,
): Promise<{ rows: AttendanceLogRow[]; total: number }> {
  const conditions = ['a.org_id = $1'];
  const params: unknown[] = [orgId];
  if (filter.dateFrom) {
    params.push(filter.dateFrom);
    conditions.push(`a.work_date >= $${params.length}`);
  }
  if (filter.dateTo) {
    params.push(filter.dateTo);
    conditions.push(`a.work_date <= $${params.length}`);
  }
  if (filter.branchId !== undefined) {
    params.push(filter.branchId);
    conditions.push(`(a.check_in_branch_id = $${params.length} OR a.check_out_branch_id = $${params.length})`);
  }
  if (filter.status) {
    params.push(filter.status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (filter.userId !== undefined) {
    params.push(filter.userId);
    conditions.push(`a.user_id = $${params.length}`);
  }
  let join = '';
  if (filter.managerId !== undefined) {
    params.push(filter.managerId);
    join = 'JOIN users u ON u.id = a.user_id AND u.org_id = a.org_id';
    conditions.push(`u.manager_id = $${params.length}`);
  }
  const where = conditions.join(' AND ');

  const countRows = await sql.query(`SELECT count(*)::int as n FROM attendance_logs a ${join} WHERE ${where}`, params);
  const total = (countRows[0] as { n: number }).n;

  params.push(pageSize, (page - 1) * pageSize);
  const rows = await sql.query(
    `SELECT ${logColumns('a')}
       FROM attendance_logs a ${join}
      WHERE ${where}
      ORDER BY a.work_date DESC, a.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows: rows as AttendanceLogRow[], total };
}

export interface DashboardRow {
  userId: number;
  name: string;
  /** The person's manager: lets the route narrow the one cached, unfiltered payload for a MANAGER. */
  managerId: number | null;
  branchId: number | null;
  branchName: string | null;
  status: AttendanceStatus | 'NOT_YET_IN';
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInIsOutside: boolean;
  checkOutIsOutside: boolean;
}

/**
 * The live-dashboard roster for one work date: every active user who is scheduled that weekday
 * (tracked, shift works that ISO weekday) UNION every active user who has a log that date, so an
 * off-day or holiday punch is on the board too. A scheduled person with no log is NOT_YET_IN, or
 * HOLIDAY when the date is a national or company holiday. managerId, when given, scopes to that
 * manager's direct reports; the dashboard route caches the unfiltered list and omits it.
 */
export async function getDashboardRows(orgId: number, workDate: string, managerId?: number): Promise<DashboardRow[]> {
  const params: unknown[] = [orgId, workDate];
  let managerFilter = '';
  if (managerId !== undefined) {
    params.push(managerId);
    managerFilter = `AND u.manager_id = $${params.length}`;
  }
  const rows = await sql.query(
    `SELECT u.id as "userId", u.name, u.manager_id as "managerId", u.branch_id as "branchId", b.name as "branchName",
            COALESCE(l.status, CASE WHEN h.holiday_date IS NOT NULL THEN 'HOLIDAY' ELSE 'NOT_YET_IN' END) as status,
            l.check_in_at as "checkInAt", l.check_out_at as "checkOutAt",
            COALESCE(l.check_in_is_outside, FALSE) as "checkInIsOutside",
            COALESCE(l.check_out_is_outside, FALSE) as "checkOutIsOutside"
       FROM users u
       LEFT JOIN shifts s ON s.id = u.shift_id AND s.org_id = u.org_id
       LEFT JOIN branches b ON b.id = u.branch_id AND b.org_id = u.org_id
       LEFT JOIN attendance_logs l ON l.user_id = u.id AND l.org_id = u.org_id AND l.work_date = $2::date
       LEFT JOIN LATERAL (
         SELECT holiday_date FROM holidays
          WHERE holiday_date = $2::date AND (org_id = $1 OR org_id IS NULL)
          LIMIT 1
       ) h ON TRUE
      WHERE u.org_id = $1 AND u.status = 'ACTIVE'
        AND (
          l.id IS NOT NULL
          OR (u.shift_id IS NOT NULL AND extract(isodow from $2::date)::text = ANY(string_to_array(s.work_days, ',')))
        )
        ${managerFilter}
      ORDER BY u.name`,
    params,
  );
  return rows as DashboardRow[];
}

/** A log that is open (checked in, not out), with the one shift fact needed to know how long it can
 * still be closed. */
export interface OpenLogRow extends AttendanceLogRow {
  shiftIsCrossDay: boolean;
}

/**
 * The person's logs with a check-in and no check-out from the last 36 hours, newest first (at most 3).
 * Check-out closes ONE of them by id, not "today's row": after midnight, or after a cross-day shift
 * ends, the work date of the row is not today's (lib/punch.ts pickOpenLog decides which is still
 * closeable, and an older one that no longer is becomes the "belum absen keluar kemarin" banner).
 * Matches the partial index idx_att_open.
 */
export async function listOpenLogsForUser(orgId: number, userId: number): Promise<OpenLogRow[]> {
  const rows = await sql.query(
    `SELECT ${logColumns('a')}, COALESCE(s.is_cross_day, FALSE) as "shiftIsCrossDay"
       FROM attendance_logs a
       LEFT JOIN shifts s ON s.id = a.shift_id AND s.org_id = a.org_id
      WHERE a.org_id = $1 AND a.user_id = $2
        AND a.check_in_at IS NOT NULL AND a.check_out_at IS NULL
        AND a.check_in_at > now() - interval '36 hours'
      ORDER BY a.check_in_at DESC
      LIMIT 3`,
    [orgId, userId],
  );
  return rows as OpenLogRow[];
}

/** The newest open log (see listOpenLogsForUser). */
export async function getOpenLogForUser(orgId: number, userId: number): Promise<OpenLogRow | null> {
  return (await listOpenLogsForUser(orgId, userId))[0] ?? null;
}

/** The name of the holiday on a date for this org (its own company holiday wins over a national
 * one on the same date), or null. A holiday never blocks a punch; it only zeroes the late minutes. */
export async function getHolidayNameForDate(orgId: number, date: string): Promise<string | null> {
  const rows = await sql.query(
    `SELECT name FROM holidays
      WHERE holiday_date = $2::date AND (org_id = $1 OR org_id IS NULL)
      ORDER BY (org_id IS NULL)
      LIMIT 1`,
    [orgId, date],
  );
  return (rows[0] as { name: string } | undefined)?.name ?? null;
}

/** Open logs (checked in, not out) for the "missing check-out" widget and its reminder
 * notification (TRD.md §12, matches idx_att_open). */
export async function listOpenLogsForOrgAndDate(orgId: number, workDate: string): Promise<AttendanceLogRow[]> {
  const rows = await sql.query(
    `SELECT ${LOG_COLUMNS} FROM attendance_logs
      WHERE org_id = $1 AND work_date = $2 AND check_in_at IS NOT NULL AND check_out_at IS NULL`,
    [orgId, workDate],
  );
  return rows as AttendanceLogRow[];
}

/**
 * Close-day cron (TRD.md §12 / ERD.md §3.2): for each active tracked user scheduled on
 * `workDate` with no log yet, insert ABSENT, or HOLIDAY if `workDate` is a national or
 * this org's holiday. Idempotent via ON CONFLICT DO NOTHING. One org at a time — the
 * cron route loops orgs (each in its own timezone) and computes "yesterday" itself.
 */
export async function insertAbsencesForOrgAndDate(orgId: number, workDate: string): Promise<number> {
  const rows = await sql.query(
    `INSERT INTO attendance_logs (org_id, user_id, shift_id, work_date, scheduled_in, scheduled_out, status, source)
     SELECT u.org_id, u.id, u.shift_id, $2::date, s.time_in, s.time_out,
            CASE WHEN h.holiday_date IS NOT NULL THEN 'HOLIDAY' ELSE 'ABSENT' END,
            'SYSTEM'
       FROM users u
       JOIN shifts s ON s.id = u.shift_id
       LEFT JOIN holidays h ON (h.org_id = u.org_id OR h.org_id IS NULL) AND h.holiday_date = $2::date
      WHERE u.org_id = $1 AND u.status = 'ACTIVE' AND u.shift_id IS NOT NULL
        AND extract(isodow from $2::date)::text = ANY(string_to_array(s.work_days, ','))
        AND NOT EXISTS (SELECT 1 FROM attendance_logs a WHERE a.user_id = u.id AND a.work_date = $2::date)
      ON CONFLICT (user_id, work_date) DO NOTHING
      RETURNING id`,
    [orgId, workDate],
  );
  return rows.length;
}

export interface ApplyCorrectionInput {
  orgId: number;
  userId: number;
  shiftId: number | null;
  workDate: string;
  scheduledIn: string | null;
  scheduledOut: string | null;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  workMinutes: number | null;
  requestId: number;
}

/** CORRECTION approval (TRD.md §8 step 3). Runs inside the caller's withTx transaction —
 * takes the withTx TxClient directly rather than the module's `sql` (TRD.md §5). */
export async function applyCorrectionToLog(client: TxClient, input: ApplyCorrectionInput): Promise<void> {
  await client.query(
    `INSERT INTO attendance_logs (
       org_id, user_id, shift_id, work_date, scheduled_in, scheduled_out,
       check_in_at, check_out_at, status, late_minutes, work_minutes, request_id, source
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'REQUEST')
     ON CONFLICT (user_id, work_date) DO UPDATE SET
       scheduled_in = EXCLUDED.scheduled_in, scheduled_out = EXCLUDED.scheduled_out,
       check_in_at = EXCLUDED.check_in_at, check_out_at = EXCLUDED.check_out_at,
       status = EXCLUDED.status, late_minutes = EXCLUDED.late_minutes, work_minutes = EXCLUDED.work_minutes,
       request_id = EXCLUDED.request_id, source = 'REQUEST', updated_at = now()`,
    [
      input.orgId,
      input.userId,
      input.shiftId,
      input.workDate,
      input.scheduledIn,
      input.scheduledOut,
      input.checkInAt,
      input.checkOutAt,
      input.status,
      input.lateMinutes,
      input.workMinutes,
      input.requestId,
    ],
  );
}

export interface ApplyRangeStatusInput {
  orgId: number;
  userId: number;
  shiftId: number;
  dateFrom: string;
  dateTo: string;
  status: AttendanceStatus;
  requestId: number;
}

/** LEAVE/SICK/PERMIT approval over a date range (TRD.md §8 step 3), one row per scheduled
 * work day in range, skipping days the shift doesn't work. Runs inside withTx. */
export async function applyRangeStatusToLogs(client: TxClient, input: ApplyRangeStatusInput): Promise<void> {
  await client.query(
    `INSERT INTO attendance_logs (org_id, user_id, shift_id, work_date, scheduled_in, scheduled_out, status, request_id, source)
     SELECT $1, $2, $3, d::date, s.time_in, s.time_out, $6, $7, 'REQUEST'
       FROM generate_series($4::date, $5::date, '1 day') d
       JOIN shifts s ON s.id = $3
      WHERE extract(isodow from d)::text = ANY(string_to_array(s.work_days, ','))
     ON CONFLICT (user_id, work_date) DO UPDATE SET
       status = EXCLUDED.status, request_id = EXCLUDED.request_id, source = 'REQUEST', updated_at = now()`,
    [input.orgId, input.userId, input.shiftId, input.dateFrom, input.dateTo, input.status, input.requestId],
  );
}
