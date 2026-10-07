import { z } from 'zod';
import { apiError, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { idParam } from '@/lib/validators/common';
import { getMonthlyRecap, getDailyAttendanceDetail } from '@/lib/queries/reports';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { buildMonthlyRecapWorkbook } from '@/lib/export/xlsx';
import { buildMonthlyRecapPdf } from '@/lib/export/pdf';

// GET /api/reports/monthly/export?month=YYYY-MM&branchId=&format=xlsx|pdf — TRD.md §6/§13.
// XLSX is the universal baseline (ERD.md §4: every seeded plan has features.export_xlsx
// true) and is never gated here; PDF requires features.export_pdf on the org's plan.
const monthlyExportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM'),
  branchId: idParam.optional(),
  format: z.enum(['xlsx', 'pdf']),
});

export async function GET(request: Request) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const { month, branchId, format } = monthlyExportQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const org = await getOrganizationPlanContext(orgId);
    if (!org) return apiError(500, 'INTERNAL_ERROR', 'Organization not found.');
    if (format === 'pdf' && !org.features.export_pdf) {
      return apiError(403, 'PLAN_UPGRADE_REQUIRED', 'PDF export requires a paid plan.');
    }

    const [recap, detail] = await Promise.all([
      getMonthlyRecap(orgId, { month, branchId }),
      getDailyAttendanceDetail(orgId, { month, branchId }),
    ]);

    const bytes =
      format === 'xlsx'
        ? buildMonthlyRecapWorkbook({ recap, detail })
        : buildMonthlyRecapPdf({ recap, orgName: org.name, periodLabel: month });

    // xlsx/pdf return Buffer | Uint8Array<ArrayBufferLike> — neither is directly BlobPart/
    // BodyInit under this TS lib (Buffer's .buffer is ArrayBufferLike, which also admits
    // SharedArrayBuffer; both work fine at runtime, this is purely a typings gap). The
    // copying Uint8Array constructor always backs onto a fresh, plain ArrayBuffer.
    return new Response(new Blob([new Uint8Array(bytes)]), {
      headers: {
        'Content-Type':
          format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
        'Content-Disposition': `attachment; filename="rekap-${month}.${format}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
