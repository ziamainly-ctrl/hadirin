import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { upsertShiftSchema } from '@/lib/validators/shifts';
import { idParam } from '@/lib/validators/common';
import { bust, cacheKeys } from '@/lib/redis';
import { bustTodayDashboard } from '@/lib/dashboard-cache';
import { getShiftByIdInOrg, updateShiftInOrg, deactivateShiftInOrg } from '@/lib/queries/shifts';

// GET /api/shifts/[id] — any active role may read (TRD.md §6).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession();
    const id = idParam.parse((await params).id);

    const shift = await getShiftByIdInOrg(orgId, id);
    return apiOk({ shift });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/shifts/[id] — OWNER/ADMIN only (TRD.md §6).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);
    const body = upsertShiftSchema.parse(await request.json());

    const shift = await updateShiftInOrg(orgId, id, body);
    await bust(cacheKeys.orgMaster(orgId));
    // Branch and shift names are on the live dashboard rows (TRD.md §10).
    await bustTodayDashboard(orgId);

    return apiOk({ shift });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/shifts/[id] — OWNER/ADMIN only. deactivateShiftInOrg decides
// hard-delete vs soft-deactivate internally: a shift referenced by a user's
// shift_id or by attendance_logs is kept and set is_active = false instead (TRD.md §6).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);

    await deactivateShiftInOrg(orgId, id);
    await bust(cacheKeys.orgMaster(orgId));
    // Branch and shift names are on the live dashboard rows (TRD.md §10).
    await bustTodayDashboard(orgId);

    return apiOk(null);
  } catch (error) {
    return handleApiError(error);
  }
}
