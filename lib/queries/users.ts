import { sql, NotFoundError, type TxClient } from '../db';
import type { UserRole } from '../constants/roles';
import type { UserStatus } from '../constants/statuses';

// password_hash never leaves this file except through getUserByLoginIdentifier
// (login) and the password-change functions (AGENTS.md domain rule #8).

export interface UserAuthContext {
  id: number;
  orgId: number;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  shiftId: number | null;
  branchId: number | null;
  managerId: number | null;
}

export interface UserSummary {
  id: number;
  orgId: number;
  branchId: number | null;
  shiftId: number | null;
  managerId: number | null;
  employeeCode: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  position: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  joinedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

const SUMMARY_COLUMNS = `
  id, org_id as "orgId", branch_id as "branchId", shift_id as "shiftId", manager_id as "managerId",
  employee_code as "employeeCode", name, email, phone, role, position, avatar_url as "avatarUrl",
  status, must_change_password as "mustChangePassword", joined_at as "joinedAt",
  last_login_at as "lastLoginAt", created_at as "createdAt"
`;

/** Login only. Returns the password hash — callers must not leak it further. */
export async function getUserByLoginIdentifier(
  identifier: string,
): Promise<(UserSummary & { passwordHash: string }) | null> {
  const isEmail = identifier.includes('@');
  const rows = await sql.query(
    `SELECT ${SUMMARY_COLUMNS}, password_hash as "passwordHash"
       FROM users
      WHERE ${isEmail ? 'lower(email) = lower($1)' : 'phone = $1'}
      LIMIT 1`,
    [identifier],
  );
  return (rows[0] as (UserSummary & { passwordHash: string }) | undefined) ?? null;
}

/** Hot path for requireSession(); cached 60s at the call site (TRD.md §10). */
export async function getUserAuthContext(userId: number): Promise<UserAuthContext | null> {
  const rows = await sql.query(
    `SELECT id, org_id as "orgId", role, status, must_change_password as "mustChangePassword",
            shift_id as "shiftId", branch_id as "branchId", manager_id as "managerId"
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId],
  );
  return (rows[0] as UserAuthContext | undefined) ?? null;
}

export async function touchLastLogin(userId: number): Promise<void> {
  await sql.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
}

export interface ListUsersFilter {
  status?: UserStatus;
  role?: UserRole;
  managerId?: number;
  branchId?: number;
  search?: string;
}

export async function listUsers(orgId: number, filter: ListUsersFilter = {}): Promise<UserSummary[]> {
  const conditions = ['org_id = $1'];
  const params: unknown[] = [orgId];
  if (filter.status) {
    params.push(filter.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filter.role) {
    params.push(filter.role);
    conditions.push(`role = $${params.length}`);
  }
  if (filter.managerId !== undefined) {
    params.push(filter.managerId);
    conditions.push(`manager_id = $${params.length}`);
  }
  if (filter.branchId !== undefined) {
    params.push(filter.branchId);
    conditions.push(`branch_id = $${params.length}`);
  }
  if (filter.search) {
    params.push(`%${filter.search}%`);
    conditions.push(`(name ILIKE $${params.length} OR employee_code ILIKE $${params.length})`);
  }
  const rows = await sql.query(
    `SELECT ${SUMMARY_COLUMNS}
       FROM users
      WHERE ${conditions.join(' AND ')}
      ORDER BY name
      LIMIT 500`,
    params,
  );
  return rows as UserSummary[];
}

export async function getUserByIdInOrg(orgId: number, userId: number): Promise<UserSummary> {
  const rows = await sql.query(`SELECT ${SUMMARY_COLUMNS} FROM users WHERE id = $1 AND org_id = $2 LIMIT 1`, [
    userId,
    orgId,
  ]);
  const row = rows[0] as UserSummary | undefined;
  if (!row) throw new NotFoundError('User not found');
  return row;
}

/**
 * Notification fallback recipients (TRD.md §8: "the requester's manager_id. If it is
 * NULL, every ACTIVE OWNER and ADMIN of the org. The same fallback applies to
 * LATE_CHECK_IN"). Only the fields lib/notify.ts actually needs.
 */
export async function listActiveOwnersAndAdmins(
  orgId: number,
): Promise<Pick<UserSummary, 'id' | 'name' | 'email' | 'phone'>[]> {
  const rows = await sql.query(
    `SELECT id, name, email, phone FROM users
      WHERE org_id = $1 AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')`,
    [orgId],
  );
  return rows as Pick<UserSummary, 'id' | 'name' | 'email' | 'phone'>[];
}

/** Active users (any role) count toward `plans.max_employees` (ERD.md §1.1 "Seat"). */
export async function countActiveSeats(orgId: number): Promise<number> {
  const rows = await sql.query(`SELECT count(*)::int as n FROM users WHERE org_id = $1 AND status = 'ACTIVE'`, [
    orgId,
  ]);
  return (rows[0] as { n: number }).n;
}

export interface InsertUserInput {
  orgId: number;
  branchId: number | null;
  shiftId: number | null;
  managerId: number | null;
  employeeCode: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  role: UserRole;
  position: string | null;
  joinedAt: string | null;
}

export async function insertUser(input: InsertUserInput): Promise<UserSummary> {
  const rows = await sql.query(
    `INSERT INTO users (org_id, branch_id, shift_id, manager_id, employee_code, name, email, phone,
                          password_hash, must_change_password, role, position, status, joined_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, TRUE, $10,$11,'ACTIVE',$12)
     RETURNING ${SUMMARY_COLUMNS}`,
    [
      input.orgId,
      input.branchId,
      input.shiftId,
      input.managerId,
      input.employeeCode,
      input.name,
      input.email,
      input.phone,
      input.passwordHash,
      input.role,
      input.position,
      input.joinedAt,
    ],
  );
  return rows[0] as UserSummary;
}

/**
 * Registration's OWNER row, inside the same withTx as organizations.ts's
 * insertOrganizationTx — the owner sets their own password at signup, so (unlike
 * insertUser, used for admin-created employees) must_change_password is FALSE here.
 */
export async function insertUserTx(client: TxClient, input: InsertUserInput): Promise<UserSummary> {
  const result = await client.query(
    `INSERT INTO users (org_id, branch_id, shift_id, manager_id, employee_code, name, email, phone,
                          password_hash, must_change_password, role, position, status, joined_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, FALSE, $10,$11,'ACTIVE',$12)
     RETURNING ${SUMMARY_COLUMNS}`,
    [
      input.orgId,
      input.branchId,
      input.shiftId,
      input.managerId,
      input.employeeCode,
      input.name,
      input.email,
      input.phone,
      input.passwordHash,
      input.role,
      input.position,
      input.joinedAt,
    ],
  );
  return result.rows[0] as UserSummary;
}

export interface UpdateUserInput {
  branchId?: number | null;
  shiftId?: number | null;
  managerId?: number | null;
  employeeCode?: string | null;
  name?: string;
  email?: string | null;
  phone?: string | null;
  role?: UserRole;
  position?: string | null;
  status?: UserStatus;
  joinedAt?: string | null;
}

const UPDATABLE_COLUMNS: Record<keyof UpdateUserInput, string> = {
  branchId: 'branch_id',
  shiftId: 'shift_id',
  managerId: 'manager_id',
  employeeCode: 'employee_code',
  name: 'name',
  email: 'email',
  phone: 'phone',
  role: 'role',
  position: 'position',
  status: 'status',
  joinedAt: 'joined_at',
};

export async function updateUserInOrg(orgId: number, userId: number, input: UpdateUserInput): Promise<UserSummary> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS) as [keyof UpdateUserInput, string][]) {
    if (key in input) {
      params.push(input[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return getUserByIdInOrg(orgId, userId);
  sets.push('updated_at = now()');
  params.push(userId, orgId);
  const rows = await sql.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND org_id = $${params.length}
     RETURNING ${SUMMARY_COLUMNS}`,
    params,
  );
  const row = rows[0] as UserSummary | undefined;
  if (!row) throw new NotFoundError('User not found');
  return row;
}

/** Users are never deleted (AGENTS.md / TRD.md §6) — only deactivated. */
export async function deactivateUserInOrg(orgId: number, userId: number): Promise<void> {
  const rows = await sql.query(
    `UPDATE users SET status = 'INACTIVE', updated_at = now() WHERE id = $1 AND org_id = $2 RETURNING id`,
    [userId, orgId],
  );
  if (rows.length === 0) throw new NotFoundError('User not found');
}

export async function setTemporaryPasswordInOrg(orgId: number, userId: number, passwordHash: string): Promise<void> {
  const rows = await sql.query(
    `UPDATE users SET password_hash = $1, must_change_password = TRUE, updated_at = now()
      WHERE id = $2 AND org_id = $3 RETURNING id`,
    [passwordHash, userId, orgId],
  );
  if (rows.length === 0) throw new NotFoundError('User not found');
}

/** Self-service change-password's "verify current password" step. */
export async function getPasswordHashById(userId: number): Promise<string | null> {
  const rows = await sql.query(`SELECT password_hash as "passwordHash" FROM users WHERE id = $1`, [userId]);
  return (rows[0] as { passwordHash: string } | undefined)?.passwordHash ?? null;
}

/** Self-service change-password (any role); clears must_change_password. */
export async function setOwnPassword(userId: number, passwordHash: string): Promise<void> {
  await sql.query(
    `UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = now() WHERE id = $2`,
    [passwordHash, userId],
  );
}
