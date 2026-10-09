import { z } from 'zod';
import { apiOk, apiCreated, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { upsertShiftSchema } from '@/lib/validators/shifts';
import { bust, cacheKeys } from '@/lib/redis';
import { bustTodayDashboard } from '@/lib/dashboard-cache';
import { listShifts, insertShift } from '@/lib/queries/shifts';

// GET /api/shifts?activeOnly=1 — any active role may read (check-in picker etc.,
// TRD.md §6: "read: all; write: OWNER, ADMIN").
const listQuerySchema = z.object({
  activeOnly: z.coerce.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { orgId } = await requireActiveSession();
    const query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const shifts = await listShifts(orgId, query);
    return apiOk({ shifts });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/shifts — OWNER/ADMIN only (TRD.md §6). No plan limit for shifts.
export async function POST(request: Request) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const body = upsertShiftSchema.parse(await request.json());

    const shift = await insertShift(orgId, {
      name: body.name,
      timeIn: body.timeIn,
      timeOut: body.timeOut,
      breakMinutes: body.breakMinutes,
      lateToleranceMinutes: body.lateToleranceMinutes,
      workDays: body.workDays,
      isCrossDay: body.isCrossDay,
    });

    await bust(cacheKeys.orgMaster(orgId));
    // Branch and shift names are on the live dashboard rows (TRD.md §10).
    await bustTodayDashboard(orgId);

    return apiCreated({ shift });
  } catch (error) {
    return handleApiError(error);
  }
}
