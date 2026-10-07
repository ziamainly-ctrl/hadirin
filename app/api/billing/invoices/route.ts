import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { listInvoicesForOrg } from '@/lib/queries/invoices';

export async function GET() {
  try {
    const { orgId } = await requireActiveSession(['OWNER']);
    const invoices = await listInvoicesForOrg(orgId);
    return apiOk({ invoices });
  } catch (error) {
    return handleApiError(error);
  }
}
