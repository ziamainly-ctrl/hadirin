import { requireSession } from '@/lib/auth';

/** Null for an anonymous visitor (the common case: the public pages have no session requirement
 * of their own). A signed-in visitor gets the home of their role instead, so the marketing header
 * and the 404 page can offer "Buka Dashboard" in place of Sign in / Masuk. EMPLOYEE lands on /m,
 * every other role on /app, matching each role's own home per their sidebar. Any failure to read
 * the session (no cookie, expired, a platform admin) is the same as signed out. */
export async function getDashboardHref(): Promise<string | null> {
  try {
    const { role } = await requireSession();
    return role === 'EMPLOYEE' ? '/m' : '/app';
  } catch {
    return null;
  }
}
