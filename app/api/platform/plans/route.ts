import { apiOk, apiCreated, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { upsertPlanSchema } from '@/lib/validators/plans';
import { listAllPlans, createPlan } from '@/lib/queries/plans';
import { parsePlanFeatures } from '@/lib/constants/plan-features';
import { bust, cacheKeys } from '@/lib/redis';

// GET /api/platform/plans — platform CMS listing, including inactive plans (ERD.md §1).
// The public pricing page uses listActivePlans() through its own unauthenticated route,
// not this one.
export async function GET() {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const plans = await listAllPlans();
    return apiOk({ plans });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/platform/plans — create a plan. Busts the public pricing cache even though
// this route itself never reads it (TRD.md §10, cacheKeys.plansPublic).
export async function POST(request: Request) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const body = upsertPlanSchema.parse(await request.json());

    // planFeaturesSchema is `.partial()` (lib/validators/plans.ts), so a provided
    // `features` object may be missing keys — coerce it to a complete PlanFeatures
    // the same way reads do (parsePlanFeatures defaults an absent key to `false`).
    // Omitted entirely, `undefined` passes through so createPlan falls back to
    // DEFAULT_PLAN_FEATURES.
    const created = await createPlan({
      ...body,
      features: body.features ? parsePlanFeatures(body.features) : undefined,
    });
    await bust(cacheKeys.plansPublic());

    return apiCreated({ plan: created });
  } catch (error) {
    return handleApiError(error);
  }
}
