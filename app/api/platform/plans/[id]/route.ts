import { apiOk, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { upsertPlanSchema } from '@/lib/validators/plans';
import { idParam } from '@/lib/validators/common';
import { updatePlan } from '@/lib/queries/plans';
import { parsePlanFeatures } from '@/lib/constants/plan-features';
import { bust, cacheKeys } from '@/lib/redis';

// PATCH /api/platform/plans/[id] — the UI submits the full plan object; same cache-bust
// as POST (TRD.md §10, cacheKeys.plansPublic).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const id = idParam.parse((await params).id);
    const body = upsertPlanSchema.parse(await request.json());

    // planFeaturesSchema is `.partial()` (lib/validators/plans.ts) — if the UI submits
    // `features`, coerce it to a complete PlanFeatures the same way reads do
    // (parsePlanFeatures defaults an absent key to `false`). Omitted entirely,
    // `undefined` passes through so updatePlan leaves the existing features untouched.
    const result = await updatePlan(id, {
      ...body,
      features: body.features ? parsePlanFeatures(body.features) : undefined,
    });
    await bust(cacheKeys.plansPublic());

    return apiOk({ plan: result });
  } catch (error) {
    return handleApiError(error);
  }
}
