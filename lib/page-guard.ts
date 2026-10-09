import 'server-only';
import { redirect } from 'next/navigation';
import { AuthError, requireSession } from './auth';
import type { RequireSessionResult } from './auth';
import type { UserRole } from './constants/roles';

/**
 * requireSession(roles) for a PAGE (Server Component). The check is identical, but a signed-in
 * person with the wrong role (a MANAGER who typed /app/reports, an ADMIN who opened /app/settings/billing)
 * is sent to `fallback` instead of the generic "Terjadi kesalahan" error screen, whose "Coba Lagi"
 * could never succeed. Every other failure still throws as before. Route handlers keep using
 * requireSession / requireActiveSession directly: an API answers 403, it does not redirect.
 */
export async function requirePageRole(
  roles: readonly UserRole[],
  fallback = '/app',
): Promise<RequireSessionResult> {
  try {
    return await requireSession(roles);
  } catch (error) {
    if (error instanceof AuthError && error.code === 'FORBIDDEN') redirect(fallback);
    throw error;
  }
}
