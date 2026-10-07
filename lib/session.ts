// Pure JWT session primitives — no Redis/DB imports, so proxy.ts can check "is there a
// valid-looking session" on every request without opening a database connection.
// proxy.ts only gates route groups; it is NOT the authorization layer (TRD.md §11) —
// lib/auth.ts's requireSession() is, and it does the DB-backed role/status check.

import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from './constants/roles';

export const SESSION_COOKIE = 'hadirin_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function getSecret(): Uint8Array {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. See .env.example.');
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export interface UserSessionPayload {
  kind: 'user';
  sub: number;
  org: number;
  role: UserRole;
}

export interface PlatformSessionPayload {
  kind: 'platform';
  sub: number;
  role: 'SUPERADMIN' | 'SUPPORT';
}

export type SessionPayload = UserSessionPayload | PlatformSessionPayload;

// jose's JWTPayload types `sub` as a string (RFC 7519 StringOrURI). Our domain types keep
// `sub` numeric for app code; it is stringified only for the wire format, here at the edge.

export async function signSession(payload: SessionPayload): Promise<string> {
  const { sub, ...rest } = payload;
  return new SignJWT({ ...rest, sub: String(sub) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/** Neon returns bigint ids as strings. Accept both so a signed session still passes the proxy. */
function asId(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const n = Number(value);
    if (Number.isSafeInteger(n)) return n;
  }
  return NaN;
}

/** Verifies signature and shape only — no DB lookup. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = asId(payload.sub);
    if (!Number.isFinite(sub)) return null;

    if (payload.kind === 'user') {
      const org = asId(payload.org);
      if (!Number.isFinite(org)) return null;
      return { kind: 'user', sub, org, role: payload.role as UserRole };
    }
    if (payload.kind === 'platform') {
      return { kind: 'platform', sub, role: payload.role as 'SUPERADMIN' | 'SUPPORT' };
    }
    return null;
  } catch {
    return null;
  }
}
