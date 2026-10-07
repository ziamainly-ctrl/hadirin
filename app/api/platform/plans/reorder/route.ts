import { apiOk, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { reorderSchema } from '@/lib/validators/plans';
import { reorderPlans } from '@/lib/queries/plans';
import { bust, cacheKeys } from '@/lib/redis';

// POST /api/platform/plans/reorder { ids } — drag-reorder; sets sort_order to each id's
// position in one transaction (lib/queries/plans.ts). Same cache-bust as POST/PATCH.
export async function POST(request: Request) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const body = reorderSchema.parse(await request.json());

    await reorderPlans(body.ids);
    await bust(cacheKeys.plansPublic());

    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
