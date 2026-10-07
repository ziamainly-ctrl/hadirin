import { z } from 'zod';
import { dateStringSchema } from './common';

// POST /api/holidays (TRD.md §6). Tenant rows only; national holidays
// (org_id IS NULL) are platform CMS, written through /api/platform/holidays.

export const createHolidaySchema = z.object({
  holidayDate: dateStringSchema,
  name: z.string().trim().min(1).max(120),
  isCollectiveLeave: z.boolean(),
});
