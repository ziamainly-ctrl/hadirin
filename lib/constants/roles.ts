// Static value sets (ERD.md §1.1) — referenced in `if` statements, so they live in code, not a table.

export const USER_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PLATFORM_ADMIN_ROLES = ['SUPERADMIN', 'SUPPORT'] as const;
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

/** OWNER and ADMIN act on the whole org; MANAGER is scoped to direct reports. */
export const ORG_WIDE_ROLES: readonly UserRole[] = ['OWNER', 'ADMIN'];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
