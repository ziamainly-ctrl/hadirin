import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { cached, cacheKeys } from '@/lib/redis';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getDashboardRows, getHolidayNameForDate, type DashboardRow } from '@/lib/queries/attendance';
import { todayWorkDateFor } from '@/lib/dashboard-cache';
import { safeTimezone } from '@/lib/safe-timezone';

// GET /api/attendance/today — live dashboard (PRD.md A1/US-03). ONE unfiltered payload per
// org and date is cached 20 s at `dash:{org}:{date}` (TRD.md §10); a MANAGER's view is cut from it
// after the cache hit (their direct reports only). That single key is the one check-in, check-out,
// approvals and user/branch/shift edits bust (lib/dashboard-cache.ts), so a new punch shows up on
// the next request instead of after the TTL (the old code cached `:all` / `:{managerId}` variants
// that nothing ever busted).
interface DashboardPayload {
  rows: DashboardRow[];
  holidayName: string | null;
}

export async function GET() {
  try {
    const { orgId, role, userId } = await requireActiveSession(['OWNER', 'ADMIN', 'MANAGER']);

    const org = await cached(cacheKeys.orgCtx(orgId), 600, () => getOrganizationPlanContext(orgId));
    if (!org) return apiOk({ rows: [], counts: emptyCounts(), holiday: null });

    const workDate = todayWorkDateFor(safeTimezone(org.timezone));

    const payload = await cached<DashboardPayload>(cacheKeys.dashboard(orgId, workDate), 20, async () => {
      const [rows, holidayName] = await Promise.all([getDashboardRows(orgId, workDate), getHolidayNameForDate(orgId, workDate)]);
      return { rows, holidayName };
    });

    const visible = role === 'MANAGER' ? payload.rows.filter((row) => row.managerId === userId) : payload.rows;
    // managerId is how the cache is narrowed, not something the board shows.
    const rows = visible.map(({ managerId: _managerId, ...row }) => row);

    const counts = {
      total: rows.length,
      checkedIn: rows.filter((r) => r.checkInAt).length,
      late: rows.filter((r) => r.status === 'LATE').length,
      notYetIn: rows.filter((r) => r.status === 'NOT_YET_IN').length,
      outsideArea: rows.filter((r) => r.checkInIsOutside || r.checkOutIsOutside).length,
      missingCheckOut: rows.filter((r) => r.checkInAt && !r.checkOutAt).length,
    };

    return apiOk({ workDate, rows, counts, holiday: payload.holidayName ? { name: payload.holidayName } : null });
  } catch (error) {
    return handleApiError(error);
  }
}

function emptyCounts() {
  return { total: 0, checkedIn: 0, late: 0, notYetIn: 0, outsideArea: 0, missingCheckOut: 0 };
}
