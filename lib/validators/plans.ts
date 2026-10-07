import { z } from 'zod';
import { idParam } from './common';

// Platform CMS, SUPERADMIN only — /api/platform/plans (ERD.md §3, TRD.md §6).

const planFeaturesSchema = z
  .object({
    export_xlsx: z.boolean(),
    export_pdf: z.boolean(),
    email_alerts: z.boolean(),
    whatsapp_alerts: z.boolean(),
    template_override: z.boolean(),
  })
  .partial();

export const upsertPlanSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(60),
  priceMonthly: z.coerce.number().int().min(0),
  maxEmployees: z.coerce.number().int().positive(),
  maxBranches: z.coerce.number().int().positive(),
  features: planFeaturesSchema.optional(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int(),
});

export const reorderSchema = z.object({
  ids: z.array(idParam).min(1),
});
