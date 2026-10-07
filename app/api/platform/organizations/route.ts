import { apiOk, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { listOrganizationsForPlatform } from '@/lib/queries/organizations';

// GET /api/platform/organizations — platform CMS listing: plan, status, seats used
// (PRD.md P1). Read-only for now — no POST/PATCH/DELETE here.
export async function GET() {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const organizations = await listOrganizationsForPlatform();
    return apiOk({ organizations });
  } catch (error) {
    return handleApiError(error);
  }
}
