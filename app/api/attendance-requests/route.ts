import { after } from 'next/server';
import { z } from 'zod';
import { apiOk, apiCreated, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { createRequestSchema } from '@/lib/validators/attendance-requests';
import { REQUEST_STATUSES, REQUEST_TYPES } from '@/lib/constants/statuses';
import { insertRequest, listRequestsForOrg } from '@/lib/queries/attendance-requests';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { notifyManagerOrOrgAdmins } from '@/lib/notify-recipients';

// GET /api/attendance-requests — TRD.md §6: review is MANAGER (own reports)/ADMIN/OWNER,
// submit is self. `mine=1` lets any role (including a manager) fetch only their own
// submissions, e.g. for a personal "my requests" history view; otherwise OWNER/ADMIN get
// the whole org, MANAGER gets their team's inbox, and EMPLOYEE always gets their own.
const listQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  type: z.enum(REQUEST_TYPES).optional(),
  mine: z.coerce.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { userId, orgId, role } = await requireActiveSession();
    const { mine, ...query } = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const isOrgWide = role === 'OWNER' || role === 'ADMIN';
    const requests = await listRequestsForOrg(orgId, {
      ...query,
      userId: mine ? userId : isOrgWide ? undefined : role === 'MANAGER' ? undefined : userId,
      managerId: !mine && role === 'MANAGER' ? userId : undefined,
    });
    return apiOk({ requests });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/attendance-requests — any active user submits for themselves.
export async function POST(request: Request) {
  try {
    const { userId, orgId, context } = await requireActiveSession();
    const body = createRequestSchema.parse(await request.json());

    const created = await insertRequest({
      orgId,
      userId,
      type: body.type,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      requestedCheckIn: body.requestedCheckIn ?? null,
      requestedCheckOut: body.requestedCheckOut ?? null,
      reason: body.reason,
      attachmentUrl: body.attachmentUrl ?? null,
    });

    after(async () => {
      const [org, requester] = await Promise.all([
        getOrganizationPlanContext(orgId),
        getUserByIdInOrg(orgId, userId).catch(() => null),
      ]);
      if (!org || !requester) return;
      await notifyManagerOrOrgAdmins({
        orgId,
        eventTrigger: 'REQUEST_SUBMITTED',
        managerId: context.managerId,
        features: org.features,
        variables: {
          employee_name: requester.name,
          request_type: created.type,
          date_range: created.dateFrom === created.dateTo ? created.dateFrom : `${created.dateFrom} – ${created.dateTo}`,
          reason: created.reason,
          // No admin approval-inbox page exists yet (that's app/app/requests/, built in
          // a later phase) — empty until that route exists to link to.
          review_url: '',
        },
        relatedRequestId: created.id,
      });
    });

    return apiCreated({ request: created });
  } catch (error) {
    return handleApiError(error);
  }
}
