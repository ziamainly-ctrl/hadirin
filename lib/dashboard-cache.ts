import { bust, cacheKeys } from './redis';
import { getLocalParts, formatDate } from './tz';
import { safeTimezone } from './safe-timezone';
import { getOrganizationPlanContext } from './queries/organizations';

// The live dashboard caches ONE unfiltered payload per org and work date at `dash:{org}:{date}`
// (20 s, TRD.md §10); a MANAGER's narrower view is cut from it after the cache hit. Any write
// that changes who is on the board or what their row says busts exactly that key. The old code
// busted `dash:{org}:{date}` but cached `dash:{org}:{date}:all` / `:{managerId}`, so a new check-in
// stayed invisible until the TTL ran out.

/** Today's calendar date on the organisation's wall clock ("YYYY-MM-DD"). */
export function todayWorkDateFor(timezone: string, now: Date = new Date()): string {
  const local = getLocalParts(now, timezone);
  return formatDate(local.year, local.month, local.day);
}

/** Deletes the cached dashboard payload of one org and date. Never throws: a Redis hiccup must not fail a punch. */
export async function bustDashboardCache(orgId: number, workDate: string): Promise<void> {
  try {
    await bust(cacheKeys.dashboard(orgId, workDate));
  } catch (error) {
    console.error('bustDashboardCache failed', error);
  }
}

/**
 * Busts today's dashboard payload for an organisation whose timezone the caller does not already hold:
 * the writes that change who is on the board or what a row shows without being a punch (a user's shift,
 * branch or status, a branch or shift being renamed or deactivated, an approved correction). TRD.md §10.
 * Never throws.
 */
export async function bustTodayDashboard(orgId: number): Promise<void> {
  try {
    const org = await getOrganizationPlanContext(orgId);
    if (!org) return;
    await bustDashboardCache(orgId, todayWorkDateFor(safeTimezone(org.timezone)));
  } catch (error) {
    console.error('bustTodayDashboard failed', error);
  }
}
