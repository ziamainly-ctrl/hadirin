import { apiOk, apiCreated, apiError, handleApiError } from '@/lib/api-response';
import { requireActiveSession, hashPassword, generateTemporaryPassword } from '@/lib/auth';
import { createUserSchema, listUsersQuerySchema } from '@/lib/validators/users';
import { listUsers, insertUser, countActiveSeats } from '@/lib/queries/users';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';

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
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const body = createUserSchema.parse(await request.json());

    const [plan, activeSeats] = await Promise.all([getOrganizationPlanContext(orgId), countActiveSeats(orgId)]);
    if (!plan) return apiError(500, 'INTERNAL_ERROR', 'Organization not found.');
    if (activeSeats >= plan.maxEmployees) {
      return apiError(422, 'SEAT_LIMIT_REACHED', `This plan allows up to ${plan.maxEmployees} employees.`);
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

    // The plaintext password appears in this one response and nowhere else (TRD.md §6
    // "returns it once") — never logged, never persisted beyond passwordHash.
    return apiCreated({ user: created, temporaryPassword: tempPassword });
  } catch (error) {
    return handleApiError(error);
  }
}
