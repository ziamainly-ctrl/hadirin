import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { upsertBranchSchema } from '@/lib/validators/branches';
import { idParam } from '@/lib/validators/common';
import { bust, cacheKeys } from '@/lib/redis';
import { getBranchByIdInOrg, updateBranchInOrg, deactivateBranchInOrg } from '@/lib/queries/branches';

// GET /api/branches/[id] — any active role may read (TRD.md §6).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession();
    const id = idParam.parse((await params).id);

    const branch = await getBranchByIdInOrg(orgId, id);
    return apiOk({ branch });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/branches/[id] — OWNER/ADMIN only (TRD.md §6).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);
    const body = upsertBranchSchema.parse(await request.json());

    const branch = await updateBranchInOrg(orgId, id, body);
    await bust(cacheKeys.orgMaster(orgId));

    return apiOk({ branch });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/branches/[id] — OWNER/ADMIN only. deactivateBranchInOrg decides
// hard-delete vs soft-deactivate internally: a branch referenced by attendance_logs
// is kept and set is_active = false instead (TRD.md §6).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);

    await deactivateBranchInOrg(orgId, id);
    await bust(cacheKeys.orgMaster(orgId));

    return apiOk(null);
  } catch (error) {
    return handleApiError(error);
  }
}
