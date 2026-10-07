import { after } from 'next/server';
import { apiOk, apiError, handleApiError, BusinessRuleError, ConflictError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { checkOutSchema } from '@/lib/validators/attendance';
import { checkinRatelimit, cached, cacheKeys, bust } from '@/lib/redis';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getShiftRuleById } from '@/lib/queries/shifts';
import { listActiveBranchesForGeofence } from '@/lib/queries/branches';
import { updateCheckOut, getLogByUserAndDate } from '@/lib/queries/attendance';
import { computeWorkDate, workMinutes as computeWorkMinutes, earlyLeaveMinutes as computeEarlyLeaveMinutes } from '@/lib/attendance-rules';
import { nearestBranch } from '@/lib/geo';

// TRD.md §7 — check-out shares the same geofence/selfie rules as check-in, then closes
// today's open log. 409 "already checked out" vs 422 "not checked in" is decided by
// looking the row up first (AGENTS.md domain rule #6: idempotent writes).
export async function POST(request: Request) {
  try {
    const { userId, orgId, context } = await requireActiveSession();

    const { success } = await checkinRatelimit.limit(String(userId));
    if (!success) return apiError(429, 'RATE_LIMITED', 'Too many attempts. Wait a moment and try again.');

    const body = checkOutSchema.parse(await request.json());

    const org = await cached(cacheKeys.orgCtx(orgId), 600, () => getOrganizationPlanContext(orgId));
    if (!org) return apiError(500, 'INTERNAL_ERROR', 'Organization not found.');
    if (org.status === 'SUSPENDED') return apiError(403, 'ORG_SUSPENDED', 'This organization is suspended.');

    if (org.selfieRequired && !body.photoUrl) {
      return apiError(400, 'VALIDATION_ERROR', 'A selfie photo is required.', { photoUrl: 'Required' });
    }
    if (!context.shiftId) {
      throw new BusinessRuleError('NOT_TRACKED', 'This account is not assigned a shift.');
    }
    const shift = await getShiftRuleById(context.shiftId);
    if (!shift) return apiError(500, 'INTERNAL_ERROR', 'Assigned shift no longer exists.');

    const now = new Date();
    const workDate = computeWorkDate(now, org.timezone, shift);

    const existing = await getLogByUserAndDate(orgId, userId, workDate);
    if (!existing || !existing.checkInAt) {
      throw new BusinessRuleError('NOT_CHECKED_IN', 'You have not checked in yet today.');
    }
    if (existing.checkOutAt) {
      throw new ConflictError('ALREADY_CHECKED_OUT', 'You have already checked out today.');
    }

    const branches = await listActiveBranchesForGeofence(orgId);
    const nearest = nearestBranch(body.latitude, body.longitude, branches);
    if (!nearest) return apiError(500, 'INTERNAL_ERROR', 'Could not resolve nearest branch.');
    if (nearest.isOutside && org.geofenceMode === 'STRICT') {
      throw new BusinessRuleError(
        'OUTSIDE_GEOFENCE',
        `You are ${nearest.distanceM}m from the nearest branch (allowed radius ${nearest.branch.radiusM}m).`,
      );
    }

    const workMinutes = computeWorkMinutes(new Date(existing.checkInAt), now, shift.breakMinutes);
    const earlyLeaveMinutes = computeEarlyLeaveMinutes(now, workDate, shift, org.timezone);

    const updated = await updateCheckOut({
      userId,
      workDate,
      branchId: nearest.branch.id,
      lat: body.latitude,
      lng: body.longitude,
      accuracyM: body.accuracyM,
      distanceM: nearest.distanceM,
      photoUrl: body.photoUrl ?? null,
      isOutside: nearest.isOutside,
      workMinutes,
      earlyLeaveMinutes,
    });
    if (!updated) throw new ConflictError('ALREADY_CHECKED_OUT', 'You have already checked out today.');

    after(() => bust(cacheKeys.dashboard(orgId, workDate)));

    return apiOk({ log: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
