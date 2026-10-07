import { z } from 'zod';
import { idParam } from './common';
import { PAYMENT_METHOD_CODES, PAYMENT_METHOD_TYPES } from '../constants/statuses';

// Platform CMS, SUPERADMIN only — /api/platform/payment-methods (ERD.md §3, TRD.md §6).

export const upsertPaymentMethodSchema = z.object({
  code: z.enum(PAYMENT_METHOD_CODES),
  name: z.string().trim().min(1).max(80),
  type: z.enum(PAYMENT_METHOD_TYPES),
  logoUrl: z.string().trim().max(500).optional(),
  adminFeeFlat: z.coerce.number().int().min(0),
  adminFeePct: z.coerce.number().min(0).max(100),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int(),
});

export const reorderSchema = z.object({
  ids: z.array(idParam).min(1),
});
