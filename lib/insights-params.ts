// Search-param parsing and role scoping shared by /app/terlambat, /app/luar-area and /app/selfie.
// Pure (no I/O) so the rules are unit-tested (tests/insights-params.test.ts). A bad or missing
// parameter always falls back to a default: these pages never answer a hand-edited URL with a 400.

import type { InsightScope } from './queries/insights';
import { ORG_WIDE_ROLES } from './constants/roles';
import type { UserRole } from './constants/roles';

export type RawSearchParams = { [key: string]: string | string[] | undefined };

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A positive integer id (branchId) or undefined. */
export function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value || !/^\d{1,15}$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

/** `?page=` as an integer >= 1 (anything else is page 1). */
export function parsePageNumber(value: string | undefined): number {
  return parsePositiveInt(value) ?? 1;
}

/** `value` when it is one of `allowed`, otherwise `fallback`. */
export function parseOneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function lastPage(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/**
 * Who sees what (AGENTS.md domain rules #1/#2, same rule as app/app/page.tsx): OWNER and ADMIN see
 * the whole org; a MANAGER only their direct reports (`managerId`); any other role gets null and
 * must be turned away by the caller (the /app layout already sends EMPLOYEE to /m).
 */
export function scopeFor(role: UserRole, userId: number, branchId: number | undefined): InsightScope | null {
  if (ORG_WIDE_ROLES.includes(role)) return { branchId };
  if (role === 'MANAGER') return { branchId, managerId: userId };
  return null;
}

/**
 * `basePath?a=1&b=2` from the current params with `overrides` applied (an empty or undefined
 * override removes the key). `page` is always dropped: changing tab or filter restarts the pager.
 */
export function hrefWith(
  basePath: string,
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value && key !== 'page') params.set(key, value);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
