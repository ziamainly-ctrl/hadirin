import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { idParam } from '@/lib/validators/common';
import { updateUserSchema } from '@/lib/validators/users';
import { getUserByIdInOrg, updateUserInOrg } from '@/lib/queries/users';
import { cacheKeys, bust } from '@/lib/redis';

// GET /api/users/[id] — admin-facing lookup, OWNER/ADMIN only (the GET list route is the
// one with the MANAGER read-own-team carve-out, not this single-user route).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);

    const user = await getUserByIdInOrg(orgId, id);
    return apiOk({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/users/[id] — OWNER/ADMIN only; a MANAGER never edits a user record.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);
    const body = updateUserSchema.parse(await request.json());

    const updated = await updateUserInOrg(orgId, id, body);
    // TRD.md §10: a role/status/shift/branch/manager change must invalidate this user's
    // cached auth context, or they stay on stale permissions for up to 60s (lib/auth.ts).
    await bust(cacheKeys.userCtx(id));

    return apiOk({ user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
