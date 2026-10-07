import { z } from 'zod';
import { idParam } from './common';

// POST /api/billing/checkout (TRD.md §9 step 2).
export const checkoutSchema = z.object({
  paymentMethodId: idParam,
});
