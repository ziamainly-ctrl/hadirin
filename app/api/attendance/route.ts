import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { listAttendanceQuerySchema } from '@/lib/validators/attendance';
import { listAttendanceForOrg } from '@/lib/queries/attendance';

// GET /api/attendance — admin table (TRD.md §6: "ADMIN+ all; MANAGER team; EMPLOYEE self").
export async function GET(request: Request) {
  try {
    const { userId, orgId, role } = await requireActiveSession();
    const query = listAttendanceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const isOrgWide = role === 'OWNER' || role === 'ADMIN';
    const { rows, total } = await listAttendanceForOrg(
      orgId,
      {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        branchId: query.branchId,
        status: query.status,
        userId: isOrgWide ? query.userId : role === 'MANAGER' ? query.userId : userId,
        managerId: role === 'MANAGER' ? userId : undefined,
      },
      query.page,
      query.pageSize,
    );

    return apiOk({ rows, total, page: query.page, pageSize: query.pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}
