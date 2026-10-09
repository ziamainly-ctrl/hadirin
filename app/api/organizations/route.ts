import { apiOk, apiError, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { updateOrganizationSchema } from '@/lib/validators/organizations';
import { getOrganizationPlanContext, updateOrganization } from '@/lib/queries/organizations';
import { cacheKeys, bust } from '@/lib/redis';

// GET /api/organizations — the caller's own org settings, with resolved plan limits/
// features (TRD.md §6: "own org only"). Any active role may view it, so no roles array.
export async function GET() {
  try {
    const { orgId } = await requireActiveSession();

    const org = await getOrganizationPlanContext(orgId);
    if (!org) return apiError(500, 'INTERNAL_ERROR', 'Organisasi tidak ditemukan.');

    return apiOk(org);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/organizations { name?, timezone?, geofenceMode?, selfieRequired?, logoUrl? }
// — TRD.md §6: own org only, there is no :id (org is always the caller's own, from the
// session). OWNER/ADMIN only (AGENTS.md domain rule #2).
export async function PATCH(request: Request) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const body = updateOrganizationSchema.parse(await request.json());

    const updated = await updateOrganization(orgId, body);
    await bust(cacheKeys.orgCtx(orgId));

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
