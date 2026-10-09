import type { UserRole } from './constants/roles';
import type { UserStatus } from './constants/statuses';

// Who may change whom (AGENTS.md domain rules #2 and #3). Pure, so it is unit-tested
// (tests/user-guards.test.ts); the routes under app/api/users load the target row and the number of
// active owners and ask this one function. Before it, an ADMIN could promote themselves to OWNER, demote
// or deactivate the real owner, mint another OWNER, or reset the owner's password and sign in as
// them, and the last owner could deactivate themselves and lock the organisation out.

export type UserChangeViolationCode = 'OWNER_ONLY' | 'ADMIN_GRANT_OWNER_ONLY' | 'LAST_OWNER';

export interface UserChangeViolation {
  code: UserChangeViolationCode;
  message: string;
}

export interface UserChangeInput {
  actorRole: UserRole;
  actorId: number;
  /** The row being changed; null when a new user is being created. */
  target: { id: number; role: UserRole; status: UserStatus } | null;
  /** The role the request sets (omitted = untouched). */
  role?: UserRole;
  /** The status the request sets (omitted = untouched). */
  status?: UserStatus;
  /** ACTIVE users with role OWNER in the organisation, counted before the change. */
  activeOwners: number;
}

export function userChangeViolation(input: UserChangeInput): UserChangeViolation | null {
  const { actorRole, target, role, status } = input;
  const changesRole = role !== undefined && role !== target?.role;
  const changesStatus = status !== undefined && status !== target?.status;

  if (actorRole !== 'OWNER') {
    // Only an OWNER makes an OWNER, whether by creating one or by promoting someone.
    if (role === 'OWNER' && target?.role !== 'OWNER') {
      return { code: 'OWNER_ONLY', message: 'Hanya pemilik yang dapat menjadikan seseorang pemilik.' };
    }
    // Only an OWNER makes an ADMIN: an ADMIN assigns MANAGER or EMPLOYEE.
    if (role === 'ADMIN' && target?.role !== 'ADMIN') {
      return { code: 'ADMIN_GRANT_OWNER_ONLY', message: 'Hanya pemilik yang dapat menjadikan seseorang admin.' };
    }
    // An owner's role and status are the owner's to change.
    if (target?.role === 'OWNER' && (changesRole || changesStatus)) {
      return { code: 'OWNER_ONLY', message: 'Peran dan status pemilik hanya dapat diubah oleh pemilik.' };
    }
  }

  // The last active owner can neither be demoted nor deactivated, by anyone (themselves included).
  if (
    target?.role === 'OWNER' &&
    target.status === 'ACTIVE' &&
    ((role !== undefined && role !== 'OWNER') || (status !== undefined && status !== 'ACTIVE')) &&
    input.activeOwners <= 1
  ) {
    return {
      code: 'LAST_OWNER',
      message: 'Organisasi harus punya setidaknya satu pemilik aktif. Jadikan orang lain pemilik dulu.',
    };
  }
  return null;
}

/** May `actorRole` reset the password of someone with `targetRole`? A reset hands back a working temporary
 * password, so resetting the owner's is taking over the owner's account: owner (or the owner themself) only. */
export function canResetPassword(actorRole: UserRole, actorId: number, target: { id: number; role: UserRole }): boolean {
  return target.role !== 'OWNER' || actorRole === 'OWNER' || target.id === actorId;
}
