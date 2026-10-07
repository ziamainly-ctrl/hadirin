import { apiOk, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { idParam } from '@/lib/validators/common';
import { deleteNationalHoliday } from '@/lib/queries/holidays';

// DELETE /api/platform/holidays/[id] — remove a national holiday. deleteNationalHoliday
// scopes the DELETE to `id AND org_id IS NULL` itself, so this can only ever remove a
// national row, never a tenant's own company holiday (there is no org on this route to
// begin with — platform routes never take an orgId).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const id = idParam.parse((await params).id);

    await deleteNationalHoliday(id);
    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
