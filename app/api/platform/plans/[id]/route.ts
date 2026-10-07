import { apiOk, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { upsertPlanSchema } from '@/lib/validators/plans';
import { idParam } from '@/lib/validators/common';
import { updatePlan } from '@/lib/queries/plans';
import { bust, cacheKeys } from '@/lib/redis';

// PATCH /api/platform/plans/[id] — the UI submits the full plan object; same cache-bust
// as POST (TRD.md §10, cacheKeys.plansPublic).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const id = idParam.parse((await params).id);
    const body = upsertPlanSchema.parse(await request.json());

    // updatePlan(id, input) merges a provided `features` onto the existing row's value
    // at the SQL level (jsonb `||`), atomically — passing the partial object straight
    // through is correct; "completing" it here first would turn the merge into a full
    // replacement (every omitted flag would arrive as an explicit `false`).
    const result = await updatePlan(id, body);
    await bust(cacheKeys.plansPublic());

    return apiOk({ plan: result });
  } catch (error) {
    return handleApiError(error);
  }
}
