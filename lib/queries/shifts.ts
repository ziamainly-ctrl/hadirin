import { sql, NotFoundError } from '../db';
import type { ShiftRule } from '../attendance-rules';

// shifts: tenant master data (ERD.md §1), edited in /app by OWNER/ADMIN (AGENTS.md).
// A user is only "tracked" (can check in, gets ABSENT/HOLIDAY rows) when
// users.shift_id IS NOT NULL (ERD.md §1.1) — that rule lives in lib/queries/users.ts,
// not here, but a shift row's identity is what that rule keys off.

export interface ShiftSummary {
  id: number;
  orgId: number;
  name: string;
  timeIn: string;
  timeOut: string;
  breakMinutes: number;
  lateToleranceMinutes: number;
  workDays: string;
  isCrossDay: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const SUMMARY_COLUMNS = `
  id, org_id as "orgId", name, time_in as "timeIn", time_out as "timeOut",
  break_minutes as "breakMinutes", late_tolerance_minutes as "lateToleranceMinutes",
  work_days as "workDays", is_cross_day as "isCrossDay", is_active as "isActive",
  created_at as "createdAt", updated_at as "updatedAt"
`;

export interface ListShiftsFilter {
  activeOnly?: boolean;
}

export async function listShifts(orgId: number, filter: ListShiftsFilter = {}): Promise<ShiftSummary[]> {
  const conditions = ['org_id = $1'];
  const params: unknown[] = [orgId];
  if (filter.activeOnly) {
    conditions.push('is_active = TRUE');
  }
  const rows = await sql.query(
    `SELECT ${SUMMARY_COLUMNS}
       FROM shifts
      WHERE ${conditions.join(' AND ')}
      ORDER BY name`,
    params,
  );
  return rows as ShiftSummary[];
}

export async function getShiftByIdInOrg(orgId: number, id: number): Promise<ShiftSummary> {
  const rows = await sql.query(`SELECT ${SUMMARY_COLUMNS} FROM shifts WHERE id = $1 AND org_id = $2 LIMIT 1`, [
    id,
    orgId,
  ]);
  const row = rows[0] as ShiftSummary | undefined;
  if (!row) throw new NotFoundError('Shift tidak ditemukan');
  return row;
}

export interface InsertShiftInput {
  name: string;
  timeIn: string;
  timeOut: string;
  breakMinutes: number;
  lateToleranceMinutes: number;
  workDays: string;
  isCrossDay: boolean;
}

export async function insertShift(orgId: number, input: InsertShiftInput): Promise<ShiftSummary> {
  const rows = await sql.query(
    `INSERT INTO shifts (org_id, name, time_in, time_out, break_minutes, late_tolerance_minutes, work_days, is_cross_day)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING ${SUMMARY_COLUMNS}`,
    [
      orgId,
      input.name,
      input.timeIn,
      input.timeOut,
      input.breakMinutes,
      input.lateToleranceMinutes,
      input.workDays,
      input.isCrossDay,
    ],
  );
  return rows[0] as ShiftSummary;
}

export interface UpdateShiftInput {
  name?: string;
  timeIn?: string;
  timeOut?: string;
  breakMinutes?: number;
  lateToleranceMinutes?: number;
  workDays?: string;
  isCrossDay?: boolean;
  isActive?: boolean;
}

const UPDATABLE_COLUMNS: Record<keyof UpdateShiftInput, string> = {
  name: 'name',
  timeIn: 'time_in',
  timeOut: 'time_out',
  breakMinutes: 'break_minutes',
  lateToleranceMinutes: 'late_tolerance_minutes',
  workDays: 'work_days',
  isCrossDay: 'is_cross_day',
  isActive: 'is_active',
};

export async function updateShiftInOrg(orgId: number, id: number, input: UpdateShiftInput): Promise<ShiftSummary> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS) as [keyof UpdateShiftInput, string][]) {
    if (key in input) {
      params.push(input[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return getShiftByIdInOrg(orgId, id);
  sets.push('updated_at = now()');
  params.push(id, orgId);
  const rows = await sql.query(
    `UPDATE shifts SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND org_id = $${params.length}
     RETURNING ${SUMMARY_COLUMNS}`,
    params,
  );
  const row = rows[0] as ShiftSummary | undefined;
  if (!row) throw new NotFoundError('Shift tidak ditemukan');
  return row;
}

/**
 * TRD.md §6: "DELETE of a branch/shift that has history only sets is_active = false."
 * A shift referenced by any user's `shift_id` or any attendance_logs row is kept and
 * deactivated instead of hard-deleted, so assignments and past logs never dangle.
 */
export async function deactivateShiftInOrg(orgId: number, id: number): Promise<void> {
  const refRows = await sql.query(
    `SELECT 1 FROM users WHERE org_id = $1 AND shift_id = $2
     UNION ALL
     SELECT 1 FROM attendance_logs WHERE org_id = $1 AND shift_id = $2
     LIMIT 1`,
    [orgId, id],
  );
  if (refRows.length > 0) {
    const rows = await sql.query(
      `UPDATE shifts SET is_active = FALSE, updated_at = now() WHERE id = $1 AND org_id = $2 RETURNING id`,
      [id, orgId],
    );
    if (rows.length === 0) throw new NotFoundError('Shift tidak ditemukan');
    return;
  }
  const rows = await sql.query(`DELETE FROM shifts WHERE id = $1 AND org_id = $2 RETURNING id`, [id, orgId]);
  if (rows.length === 0) throw new NotFoundError('Shift tidak ditemukan');
}

/**
 * Feeds the pure rule functions in lib/attendance-rules.ts for the check-in/check-out
 * route. Not org-scoped: callers already hold this shift's id from the authenticated
 * user's own `shift_id` (AGENTS.md domain rule #1 covers the user lookup that produced
 * it), so this is a plain by-key fetch, not a tenant listing. Returns null instead of
 * throwing — mirrors getUserAuthContext() in users.ts, a hot-path-by-id lookup that
 * lets the caller decide how to react to a missing row.
 */
export async function getShiftRuleById(id: number): Promise<ShiftRule | null> {
  const rows = await sql.query(
    `SELECT time_in as "timeIn", time_out as "timeOut", break_minutes as "breakMinutes",
            late_tolerance_minutes as "lateToleranceMinutes", is_cross_day as "isCrossDay"
       FROM shifts
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  return (rows[0] as ShiftRule | undefined) ?? null;
}
