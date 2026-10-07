import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { cached, cacheKeys } from '@/lib/redis';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getDashboardRows } from '@/lib/queries/attendance';
import { getLocalParts, formatDate } from '@/lib/tz';

// GET /api/attendance/today — live dashboard (PRD.md A1/US-03). Cached 20s per
// org+date (TRD.md §10); a MANAGER's view is filtered to their own reports.
export async function GET() {
  try {
    const { orgId, role, userId } = await requireActiveSession(['OWNER', 'ADMIN', 'MANAGER']);

    const org = await cached(cacheKeys.orgCtx(orgId), 600, () => getOrganizationPlanContext(orgId));
    if (!org) return apiOk({ rows: [], counts: emptyCounts() });

    const local = getLocalParts(new Date(), org.timezone);
    const workDate = formatDate(local.year, local.month, local.day);
    const managerId = role === 'MANAGER' ? userId : undefined;

    const rows = await cached(
      `${cacheKeys.dashboard(orgId, workDate)}:${managerId ?? 'all'}`,
      20,
      () => getDashboardRows(orgId, workDate, managerId),
    );

    const counts = {
      total: rows.length,
      checkedIn: rows.filter((r) => r.status !== 'NOT_YET_IN').length,
      late: rows.filter((r) => r.status === 'LATE').length,
      notYetIn: rows.filter((r) => r.status === 'NOT_YET_IN').length,
      outsideArea: rows.filter((r) => r.checkInIsOutside || r.checkOutIsOutside).length,
      missingCheckOut: rows.filter((r) => r.checkInAt && !r.checkOutAt).length,
    };

    return apiOk({ workDate, rows, counts });
  } catch (error) {
    return handleApiError(error);
  }
}

function emptyCounts() {
  return { total: 0, checkedIn: 0, late: 0, notYetIn: 0, outsideArea: 0, missingCheckOut: 0 };
}
