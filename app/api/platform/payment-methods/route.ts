import { apiOk, apiCreated, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { upsertPaymentMethodSchema } from '@/lib/validators/payment-methods';
import { listAllPaymentMethods, createPaymentMethod } from '@/lib/queries/payment-methods';
import { bust, cacheKeys } from '@/lib/redis';

// GET /api/platform/payment-methods — platform CMS listing, including inactive methods
// (ERD.md §1). The billing picker uses listActivePaymentMethods() through its own
// unauthenticated route, not this one.
export async function GET() {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const paymentMethods = await listAllPaymentMethods();
    return apiOk({ paymentMethods });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/platform/payment-methods — create a method. Busts the billing picker cache
// even though this route itself never reads it (TRD.md §10, cacheKeys.paymentMethodsActive).
export async function POST(request: Request) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const body = upsertPaymentMethodSchema.parse(await request.json());

    const created = await createPaymentMethod(body);
    await bust(cacheKeys.paymentMethodsActive());

    return apiCreated({ method: created });
  } catch (error) {
    return handleApiError(error);
  }
}
