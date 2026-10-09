import { apiOk, apiError, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { precheckSchema, MAX_PUNCH_ACCURACY_M } from '@/lib/validators/attendance';
import { precheckRatelimit } from '@/lib/precheck-ratelimit';
import { loadPunchContext } from '@/lib/punch-context';
import { nearestBranch } from '@/lib/geo';
import type { PrecheckAction, PrecheckBlock, PrecheckResult } from '@/lib/punch-types';

// POST /api/attendance/precheck — what would happen if this person punched from here, right now?
// The "Hari ini" screen shows the answer before the selfie is taken: which branch, how far, inside
// or outside the radius, whether the punch is allowed. It is ADVISORY: the decision is made by the
// server from the session and the database, and the punch routes recompute all of it, so a client
// that lies here gains nothing (AGENTS.md domain rules #3-#5). Writes nothing.

export async function POST(request: Request) {
  try {
    const { userId, orgId, context } = await requireActiveSession();
    const { success } = await precheckRatelimit.limit(String(userId));
    if (!success) return apiError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.');

    const body = precheckSchema.parse(await request.json());
    const pc = await loadPunchContext({ orgId, userId, shiftId: context.shiftId });
    const { org } = pc;

    const accuracyClass = body.accuracyM > MAX_PUNCH_ACCURACY_M ? 'too-low' : body.accuracyM > 100 ? 'weak' : 'good';
    const nearest = pc.activeBranches.length > 0 ? nearestBranch(body.latitude, body.longitude, pc.activeBranches) : null;
    const branch = nearest
      ? {
          id: nearest.branch.id,
          name: nearest.branch.name,
          distanceM: nearest.distanceM,
          radiusM: nearest.branch.radiusM,
          isInside: !nearest.isOutside,
        }
      : null;

    let action: PrecheckAction;
    let block: PrecheckBlock | null = null;

    if (org.status === 'SUSPENDED') {
      action = 'suspended';
      block = 'ORG_SUSPENDED';
    } else if (!pc.shift || !pc.target) {
      action = 'not-tracked';
      block = 'NOT_TRACKED';
    } else if (pc.activeBranches.length === 0) {
      action = 'no-branch';
      block = 'NO_BRANCHES';
    } else {
      action = pc.target.action;
      if (action === 'done') block = 'ALREADY_DONE';
      else if (action === 'recorded') block = 'ALREADY_RECORDED';
      else if (action === 'expired') block = 'CHECKOUT_WINDOW_CLOSED';
    }

    if (!block && accuracyClass === 'too-low') block = 'ACCURACY_TOO_LOW';
    if (!block && branch && !branch.isInside && org.geofenceMode === 'STRICT') block = 'OUTSIDE_GEOFENCE';

    const result: PrecheckResult = {
      action,
      canSubmit: block === null,
      block,
      geofenceMode: org.geofenceMode,
      selfieRequired: org.selfieRequired,
      branch,
      accuracyM: body.accuracyM,
      accuracyClass,
      // In FLAG mode an outside punch is accepted and marked; the screen says so before the photo.
      willFlagOutside: Boolean(branch && !branch.isInside && org.geofenceMode === 'FLAG'),
      dayKind: pc.dayKind,
      holidayName: pc.holidayName,
      serverNow: new Date().toISOString(),
    };
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
