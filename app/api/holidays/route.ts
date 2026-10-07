import { z } from 'zod';
import { apiOk, apiCreated, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { createHolidaySchema } from '@/lib/validators/holidays';
import { listHolidays, insertCompanyHoliday } from '@/lib/queries/holidays';

// GET /api/holidays — TRD.md §6: read is any active role (national + the caller's own
// org holidays). Optional `?year=2026` narrows to one calendar year.
const listQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
});

export async function GET(request: Request) {
  try {
    const { orgId } = await requireActiveSession();
    const { year } = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const holidays = await listHolidays(orgId, { year });
    return apiOk({ holidays });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/holidays — TRD.md §6: write is OWNER, ADMIN only. Always creates a company
// holiday for the caller's own org — insertCompanyHoliday only ever writes this org_id;
// national holidays are platform CMS, written through /api/platform/holidays (ERD.md §1.1).
export async function POST(request: Request) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const body = createHolidaySchema.parse(await request.json());

    const holiday = await insertCompanyHoliday(orgId, body);
    return apiCreated({ holiday });
  } catch (error) {
    return handleApiError(error);
  }
}
