import { z } from 'zod';
import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { idParam } from '@/lib/validators/common';
import { getMonthlyRecap } from '@/lib/queries/reports';

// GET /api/reports/monthly?month=YYYY-MM&branchId= — TRD.md §6/§13: the on-screen monthly
// recap table. Available regardless of the org's plan — `features.export_xlsx`/`export_pdf`
// only gate which FILE FORMATS /api/reports/monthly/export can produce, not this endpoint.
const monthlyRecapQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM'),
  branchId: idParam.optional(),
});

export async function GET(request: Request) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const { month, branchId } = monthlyRecapQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const recap = await getMonthlyRecap(orgId, { month, branchId });
    return apiOk({ recap });
  } catch (error) {
    return handleApiError(error);
  }
}
