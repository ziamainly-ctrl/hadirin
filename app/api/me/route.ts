import { apiOk, handleApiError } from '@/lib/api-response';
import { requireSession } from '@/lib/auth';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { loadPunchContext } from '@/lib/punch-context';

// GET /api/me — profile + org/plan + today's log. Uses requireSession(), not
// requireActiveSession(): the client needs mustChangePassword from here to decide
// whether to redirect to /change-password in the first place (TRD.md §11).
//
// `today` is the log of the person's current work date (as before); `punch` is what the
// "Hari ini" screen would offer right now, resolved by the same rules the punch routes use
// (lib/punch.ts), so a client can show the right button without a second round trip.
export async function GET() {
  try {
    const { userId, orgId } = await requireSession();

    const user = await getUserByIdInOrg(orgId, userId);
    const pc = await loadPunchContext({ orgId, userId, shiftId: user.shiftId });

    return apiOk({
      user,
      organization: pc.org,
      today: pc.todayLog,
      punch: pc.target
        ? {
            action: pc.target.action,
            workDate: pc.target.workDate,
            dayKind: pc.dayKind,
            holidayName: pc.holidayName,
            openLogId: pc.target.action === 'check-out' ? (pc.target.log?.id ?? null) : null,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
