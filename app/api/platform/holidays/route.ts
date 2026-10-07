import { z } from 'zod';
import { apiOk, apiCreated, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { createHolidaySchema } from '@/lib/validators/holidays';
import { listNationalHolidays, insertNationalHoliday } from '@/lib/queries/holidays';

// GET /api/platform/holidays — platform CMS listing of national holidays only
// (org_id IS NULL). Optional `?year=2026` narrows to one calendar year, same as the
// tenant-side /api/holidays.
const listQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
});

export async function GET(request: Request) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const { year } = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const holidays = await listNationalHolidays({ year });
    return apiOk({ holidays });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/platform/holidays — add a national holiday. insertNationalHoliday always
// writes org_id = NULL; a company (tenant) holiday is created through /api/holidays
// instead (ERD.md §1.1).
export async function POST(request: Request) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const body = createHolidaySchema.parse(await request.json());

    const holiday = await insertNationalHoliday(body);
    return apiCreated({ holiday });
  } catch (error) {
    return handleApiError(error);
  }
}
