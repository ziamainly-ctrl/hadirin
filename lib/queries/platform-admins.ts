import { sql } from '../db';
import type { PlatformAdminRole } from '../constants/roles';
import type { UserStatus } from '../constants/statuses';

// platform_admins stands alone, no org_id (ERD.md §2 "platform_admins stands alone (no
// tenant)"). password_hash never leaves this file except through getPlatformAdminByEmail
// (login) — same rule as users.ts (AGENTS.md domain rule #8).

export interface PlatformAdminSummary {
  id: number;
  name: string;
  email: string;
  role: PlatformAdminRole;
  status: UserStatus;
  createdAt: string;
}

const SUMMARY_COLUMNS = `id, name, email, role, status, created_at as "createdAt"`;

/** Login only. Returns the password hash — callers must not leak it further. */
export async function getPlatformAdminByEmail(
  email: string,
): Promise<(PlatformAdminSummary & { passwordHash: string }) | null> {
  const rows = await sql.query(
    `SELECT ${SUMMARY_COLUMNS}, password_hash as "passwordHash" FROM platform_admins WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  return (rows[0] as (PlatformAdminSummary & { passwordHash: string }) | undefined) ?? null;
}

/** requirePlatformSession()'s hot-path reload, same role as getUserAuthContext() in users.ts. */
export async function getPlatformAdminAuthContext(
  id: number,
): Promise<Pick<PlatformAdminSummary, 'id' | 'role' | 'status'> | null> {
  const rows = await sql.query(`SELECT id, role, status FROM platform_admins WHERE id = $1`, [id]);
  return (rows[0] as Pick<PlatformAdminSummary, 'id' | 'role' | 'status'> | undefined) ?? null;
}
