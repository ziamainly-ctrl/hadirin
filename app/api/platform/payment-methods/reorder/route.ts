import { apiOk, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { reorderSchema } from '@/lib/validators/payment-methods';
import { reorderPaymentMethods } from '@/lib/queries/payment-methods';
import { bust, cacheKeys } from '@/lib/redis';

// POST /api/platform/payment-methods/reorder { ids } — drag-reorder; sets sort_order to
// each id's position in one transaction (lib/queries/payment-methods.ts). Same cache-bust
// as POST/PATCH.
export async function POST(request: Request) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const body = reorderSchema.parse(await request.json());

    await reorderPaymentMethods(body.ids);
    await bust(cacheKeys.paymentMethodsActive());

    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
