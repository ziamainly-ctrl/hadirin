import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { idParam } from '@/lib/validators/common';
import { deleteCompanyHolidayInOrg } from '@/lib/queries/holidays';

// DELETE /api/holidays/[id] — TRD.md §6: write is OWNER, ADMIN only. deleteCompanyHolidayInOrg
// scopes the DELETE to `id AND org_id` itself, so this can only ever remove the caller's own
// org's holiday row — never a national (org_id IS NULL) row or another org's. No cache bust:
// holidays are not in the TRD.md §10 cache key table.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);

    await deleteCompanyHolidayInOrg(orgId, id);
    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
