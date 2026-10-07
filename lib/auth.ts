import 'server-only';
import { cookies } from 'next/headers';
import { cached, cacheKeys } from './redis';
import { getUserAuthContext, type UserAuthContext } from './queries/users';
import { getPlatformAdminAuthContext } from './queries/platform-admins';
import { USER_ROLES, type UserRole } from './constants/roles';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySessionToken,
  type SessionPayload,
  type UserSessionPayload,
  type PlatformSessionPayload,
} from './session';
import { hashPassword, verifyPassword, generateTemporaryPassword } from './password';
import { normalizePhone } from './phone';

export { SESSION_COOKIE, signSession, hashPassword, verifyPassword, generateTemporaryPassword, normalizePhone };
export type { SessionPayload, UserSessionPayload, PlatformSessionPayload };

// ---------- JWT session (cookie helpers; signing/verifying primitives live in lib/session.ts) ----------

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export class AuthError extends Error {
  constructor(
    public code: 'NO_SESSION' | 'FORBIDDEN' | 'INACTIVE' | 'SUSPENDED' | 'PASSWORD_CHANGE_REQUIRED',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface RequireSessionResult {
  userId: number;
  orgId: number;
  role: UserRole;
  context: UserAuthContext;
}

/**
 * Re-verifies the JWT and reloads user state (cached 60s). Every protected route
 * handler must call this — proxy.ts only gates route groups (TRD.md §11).
 */
export async function requireSession(roles?: readonly UserRole[]): Promise<RequireSessionResult> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) throw new AuthError('NO_SESSION', 'No session');

  const payload = await verifySessionToken(token);
  if (!payload || payload.kind !== 'user') throw new AuthError('NO_SESSION', 'No session');

  const context = await cached(cacheKeys.userCtx(payload.sub), 60, () => getUserAuthContext(payload.sub));
  if (!context) throw new AuthError('NO_SESSION', 'No session');
  if (context.status !== 'ACTIVE') throw new AuthError('INACTIVE', 'User is inactive');
  if (roles && !roles.includes(context.role)) throw new AuthError('FORBIDDEN', 'Wrong role');

  return { userId: context.id, orgId: context.orgId, role: context.role, context };
}

/**
 * Like requireSession, but also enforces the must-change-password gate (TRD.md §11).
 * Use on every route except /api/auth/change-password and /api/auth/logout.
 */
export async function requireActiveSession(roles?: readonly UserRole[]): Promise<RequireSessionResult> {
  const result = await requireSession(roles);
  if (result.context.mustChangePassword) {
    throw new AuthError('PASSWORD_CHANGE_REQUIRED', 'Password change required');
  }
  return result;
}

export interface RequirePlatformSessionResult {
  adminId: number;
  role: 'SUPERADMIN' | 'SUPPORT';
}

/** Same reload-from-DB discipline as requireSession() — a deactivated platform admin's
 * token must stop working well before its 7-day expiry (AGENTS.md domain rule #1/#2). */
export async function requirePlatformSession(
  roles?: readonly ('SUPERADMIN' | 'SUPPORT')[],
): Promise<RequirePlatformSessionResult> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) throw new AuthError('NO_SESSION', 'No session');

  const payload = await verifySessionToken(token);
  if (!payload || payload.kind !== 'platform') throw new AuthError('NO_SESSION', 'No session');

  const context = await cached(cacheKeys.platformAdminCtx(payload.sub), 60, () =>
    getPlatformAdminAuthContext(payload.sub),
  );
  if (!context) throw new AuthError('NO_SESSION', 'No session');
  if (context.status !== 'ACTIVE') throw new AuthError('INACTIVE', 'Admin is inactive');
  if (roles && !roles.includes(context.role)) throw new AuthError('FORBIDDEN', 'Wrong role');

  return { adminId: context.id, role: context.role };
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
