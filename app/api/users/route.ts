import { apiOk, apiCreated, apiError, handleApiError } from '@/lib/api-response';
import { AuthError, requireActiveSession, hashPassword, generateTemporaryPassword } from '@/lib/auth';
import { createUserSchema, listUsersQuerySchema } from '@/lib/validators/users';
import { listUsers, insertUser, countActiveSeats, assertUserRefsInOrg } from '@/lib/queries/users';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { userChangeViolation } from '@/lib/user-guards';
import { bustTodayDashboard } from '@/lib/dashboard-cache';

// GET /api/users — TRD.md §6: OWNER/ADMIN list the whole org; MANAGER gets read-only
// access to their own team only ("MANAGER read own team"), scoped via listUsers's
// managerId filter set to the caller's own id — never accepted from the query string.
export async function GET(request: Request) {
  try {
    const { userId, orgId, role } = await requireActiveSession(['OWNER', 'ADMIN', 'MANAGER']);
    const query = listUsersQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const isOrgWide = role === 'OWNER' || role === 'ADMIN';
    const users = await listUsers(orgId, {
      ...query,
      managerId: isOrgWide ? undefined : userId,
    });
    return apiOk({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/users — TRD.md §6: "POST generates a temporary password, returns it once,
// sets must_change_password" (insertUser already defaults that column to TRUE).
export async function POST(request: Request) {
  try {
    const { orgId, userId, role } = await requireActiveSession(['OWNER', 'ADMIN']);
    const body = createUserSchema.parse(await request.json());

    // Only an OWNER creates an OWNER or an ADMIN (lib/user-guards.ts); the branch, shift and manager
    // must be this organisation's own (AGENTS.md domain rules #3 and #7).
    const violation = userChangeViolation({ actorRole: role, actorId: userId, target: null, role: body.role, activeOwners: 0 });
    if (violation) throw new AuthError('FORBIDDEN', violation.message);
    await assertUserRefsInOrg(orgId, body);

    const [plan, activeSeats] = await Promise.all([getOrganizationPlanContext(orgId), countActiveSeats(orgId)]);
    if (!plan) return apiError(500, 'INTERNAL_ERROR', 'Organisasi tidak ditemukan.');
    if (activeSeats >= plan.maxEmployees) {
      return apiError(422, 'SEAT_LIMIT_REACHED', `Paket Anda mengizinkan maksimal ${plan.maxEmployees} karyawan. Naikkan paket untuk menambah.`);
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    const created = await insertUser({
      orgId,
      name: body.name,
      role: body.role,
      email: body.email ?? null,
      phone: body.phone ?? null,
      branchId: body.branchId ?? null,
      shiftId: body.shiftId ?? null,
      managerId: body.managerId ?? null,
      employeeCode: body.employeeCode ?? null,
      position: body.position ?? null,
      joinedAt: body.joinedAt ?? null,
      passwordHash,
    });

    // A newly scheduled person joins today's dashboard rows (TRD.md §10).
    if (created.shiftId !== null) await bustTodayDashboard(orgId);

    // The plaintext password appears in this one response and nowhere else (TRD.md §6
    // "returns it once") — never logged, never persisted beyond passwordHash.
    return apiCreated({ user: created, temporaryPassword: tempPassword });
  } catch (error) {
    return handleApiError(error);
  }
}
