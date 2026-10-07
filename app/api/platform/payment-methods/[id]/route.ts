import { apiOk, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { upsertPaymentMethodSchema } from '@/lib/validators/payment-methods';
import { idParam } from '@/lib/validators/common';
import { updatePaymentMethod } from '@/lib/queries/payment-methods';
import { bust, cacheKeys } from '@/lib/redis';

// PATCH /api/platform/payment-methods/[id] — the UI submits the full method object; same
// cache-bust as POST (TRD.md §10, cacheKeys.paymentMethodsActive).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const id = idParam.parse((await params).id);
    const body = upsertPaymentMethodSchema.parse(await request.json());

    const result = await updatePaymentMethod(id, body);
    await bust(cacheKeys.paymentMethodsActive());

    return apiOk({ method: result });
  } catch (error) {
    return handleApiError(error);
  }
}
