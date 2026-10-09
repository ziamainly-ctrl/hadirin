import { apiOk, handleApiError, BusinessRuleError } from '@/lib/api-response';
import { AuthError, requireActiveSession } from '@/lib/auth';
import { idParam } from '@/lib/validators/common';
import { updateUserSchema } from '@/lib/validators/users';
import { assertUserRefsInOrg, countActiveOwners, getUserByIdInOrg, updateUserInOrg } from '@/lib/queries/users';
import { userChangeViolation } from '@/lib/user-guards';
import { bustTodayDashboard } from '@/lib/dashboard-cache';
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
    const { orgId, userId, role } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);
    const body = updateUserSchema.parse(await request.json());

    // Cross-tenant ids are a 404 here (getUserByIdInOrg) before anything else is looked at.
    const target = await getUserByIdInOrg(orgId, id);
    const violation = userChangeViolation({
      actorRole: role,
      actorId: userId,
      target,
      role: body.role,
      status: body.status,
      activeOwners: await countActiveOwners(orgId),
    });
    if (violation) {
      if (violation.code === 'LAST_OWNER') throw new BusinessRuleError(violation.code, violation.message);
      throw new AuthError('FORBIDDEN', violation.message);
    }
    // The shift, branch and manager named in the body must be this organisation's own (the
    // check-in setup wizard PATCHes the owner's own shiftId and branchId through here).
    await assertUserRefsInOrg(orgId, body);

    const updated = await updateUserInOrg(orgId, id, body);
    // TRD.md §10: a role/status/shift/branch/manager change must invalidate this user's
    // cached auth context, or they stay on stale permissions for up to 60s (lib/auth.ts).
    await bust(cacheKeys.userCtx(id));
    // ...and today's dashboard payload, which lists scheduled people with their branch and status.
    await bustTodayDashboard(orgId);

    return apiOk({ user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
