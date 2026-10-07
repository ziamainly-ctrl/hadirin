import { z } from 'zod';
import { apiOk, apiCreated, apiError, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { upsertBranchSchema } from '@/lib/validators/branches';
import { bust, cacheKeys } from '@/lib/redis';
import { listBranches, insertBranch, countActiveBranches } from '@/lib/queries/branches';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';

// GET /api/branches?activeOnly=1 — any active role may read (check-in picker etc.,
// TRD.md §6: "read: all; write: OWNER, ADMIN").
const listQuerySchema = z.object({
  activeOnly: z.coerce.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { orgId } = await requireActiveSession();
    const query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const branches = await listBranches(orgId, query);
    return apiOk({ branches });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/branches — OWNER/ADMIN only (TRD.md §6). Enforces plans.max_branches
// before inserting.
export async function POST(request: Request) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const body = upsertBranchSchema.parse(await request.json());

    const plan = await getOrganizationPlanContext(orgId);
    if (!plan) return apiError(500, 'INTERNAL_ERROR', 'Organization not found.');

    const activeBranches = await countActiveBranches(orgId);
    if (activeBranches >= plan.maxBranches) {
      return apiError(422, 'SEAT_LIMIT_REACHED', `This plan allows up to ${plan.maxBranches} branches.`);
    }

    const branch = await insertBranch(orgId, {
      name: body.name,
      address: body.address ?? null,
      latitude: body.latitude,
      longitude: body.longitude,
      radiusM: body.radiusM,
    });

    await bust(cacheKeys.orgMaster(orgId));

    return apiCreated({ branch });
  } catch (error) {
    return handleApiError(error);
  }
}
