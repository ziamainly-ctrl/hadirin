import { after } from 'next/server';
import { apiOk, apiError, handleApiError, BusinessRuleError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { checkInSchema } from '@/lib/validators/attendance';
import { checkinRatelimit, cached, cacheKeys, bust } from '@/lib/redis';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getShiftRuleById } from '@/lib/queries/shifts';
import { listActiveBranchesForGeofence, getBranchByIdInOrg } from '@/lib/queries/branches';
import { isHoliday } from '@/lib/queries/holidays';
import { insertCheckIn, getLogByUserAndDate } from '@/lib/queries/attendance';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { computeWorkDate, lateMinutes as computeLateMinutes } from '@/lib/attendance-rules';
import { nearestBranch } from '@/lib/geo';
import { notifyManagerOrOrgAdmins } from '@/lib/notify-recipients';

// TRD.md §7 — the full check-in flow. Idempotent: a second check-in on the same work
// date returns the existing row with 200, never a duplicate (AGENTS.md domain rule #6).
export async function POST(request: Request) {
  try {
    const { userId, orgId, context } = await requireActiveSession();

    const { success } = await checkinRatelimit.limit(String(userId));
    if (!success) return apiError(429, 'RATE_LIMITED', 'Too many attempts. Wait a moment and try again.');

    const body = checkInSchema.parse(await request.json());

    const org = await cached(cacheKeys.orgCtx(orgId), 600, () => getOrganizationPlanContext(orgId));
    if (!org) return apiError(500, 'INTERNAL_ERROR', 'Organization not found.');
    if (org.status === 'SUSPENDED') return apiError(403, 'ORG_SUSPENDED', 'This organization is suspended.');

    if (org.selfieRequired && !body.photoUrl) {
      return apiError(400, 'VALIDATION_ERROR', 'A selfie photo is required.', { photoUrl: 'Required' });
    }

    if (!context.shiftId) {
      throw new BusinessRuleError('NOT_TRACKED', 'This account is not assigned a shift and cannot check in.');
    }
    const shift = await getShiftRuleById(context.shiftId);
    if (!shift) return apiError(500, 'INTERNAL_ERROR', 'Assigned shift no longer exists.');

    const now = new Date();
    const workDate = computeWorkDate(now, org.timezone, shift);

    const branches = await listActiveBranchesForGeofence(orgId);
    if (branches.length === 0) {
      throw new BusinessRuleError('NO_BRANCHES', 'No active branch is configured for this organization yet.');
    }
    const nearest = nearestBranch(body.latitude, body.longitude, branches);
    if (!nearest) return apiError(500, 'INTERNAL_ERROR', 'Could not resolve nearest branch.');
    if (nearest.isOutside && org.geofenceMode === 'STRICT') {
      throw new BusinessRuleError(
        'OUTSIDE_GEOFENCE',
        `You are ${nearest.distanceM}m from the nearest branch (allowed radius ${nearest.branch.radiusM}m).`,
      );
    }

    const onHoliday = await isHoliday(orgId, workDate);
    const lateMinutes = onHoliday ? 0 : computeLateMinutes(now, workDate, shift, org.timezone);
    const status = lateMinutes > 0 ? 'LATE' : 'PRESENT';

    const inserted = await insertCheckIn({
      orgId,
      userId,
      shiftId: context.shiftId,
      workDate,
      scheduledIn: shift.timeIn,
      scheduledOut: shift.timeOut,
      branchId: nearest.branch.id,
      lat: body.latitude,
      lng: body.longitude,
      accuracyM: body.accuracyM,
      distanceM: nearest.distanceM,
      photoUrl: body.photoUrl ?? null,
      isOutside: nearest.isOutside,
      status,
      lateMinutes,
    });

    // Idempotent re-check-in: ON CONFLICT DO NOTHING means `inserted` is null. Return
    // the existing row with 200 rather than treating this as a new check-in.
    const log = inserted ?? (await getLogByUserAndDate(orgId, userId, workDate));
    if (!log) return apiError(500, 'INTERNAL_ERROR', 'Check-in could not be recorded.');

    after(async () => {
      await bust(cacheKeys.dashboard(orgId, workDate));
      if (inserted && status === 'LATE') {
        const [employee, branch] = await Promise.all([
          getUserByIdInOrg(orgId, userId).catch(() => null),
          getBranchByIdInOrg(orgId, nearest.branch.id).catch(() => null),
        ]);
        await notifyManagerOrOrgAdmins({
          orgId,
          eventTrigger: 'LATE_CHECK_IN',
          managerId: context.managerId,
          features: org.features,
          variables: {
            employee_name: employee?.name ?? `#${userId}`,
            branch_name: branch?.name ?? `#${nearest.branch.id}`,
            check_in_time: now.toLocaleTimeString('id-ID', { timeZone: org.timezone, hour: '2-digit', minute: '2-digit' }),
            late_minutes: String(lateMinutes),
          },
          relatedAttendanceLogId: log.id,
        });
      }
    });

    return apiOk({ log, isNewCheckIn: Boolean(inserted) }, inserted ? 201 : 200);
  } catch (error) {
    return handleApiError(error);
  }
}
