import { apiOk, handleApiError } from '@/lib/api-response';
import { requireSession } from '@/lib/auth';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getShiftRuleById } from '@/lib/queries/shifts';
import { getLogByUserAndDate } from '@/lib/queries/attendance';
import { computeWorkDate } from '@/lib/attendance-rules';

// GET /api/me — profile + org/plan + today's log. Uses requireSession(), not
// requireActiveSession(): the client needs mustChangePassword from here to decide
// whether to redirect to /change-password in the first place (TRD.md §11).
export async function GET() {
  try {
    const { userId, orgId } = await requireSession();

    const [user, org] = await Promise.all([getUserByIdInOrg(orgId, userId), getOrganizationPlanContext(orgId)]);
    if (!org) throw new Error(`Organization ${orgId} missing a plan context`);

    let today = null;
    if (user.shiftId) {
      const shift = await getShiftRuleById(user.shiftId);
      if (shift) {
        const workDate = computeWorkDate(new Date(), org.timezone, shift);
        today = await getLogByUserAndDate(orgId, userId, workDate);
      }
    }

    return apiOk({ user, organization: org, today });
  } catch (error) {
    return handleApiError(error);
  }
}
