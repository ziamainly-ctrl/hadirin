import { z } from 'zod';
import { timeStringSchema } from './common';

// Shared by POST /api/shifts and PATCH /api/shifts/[id] (TRD.md §6).

export const upsertShiftSchema = z.object({
  name: z.string().trim().min(1).max(60),
  timeIn: timeStringSchema,
  timeOut: timeStringSchema,
  breakMinutes: z.coerce.number().int().min(0),
  lateToleranceMinutes: z.coerce.number().int().min(0),
  // Comma list of ISO weekdays, 1=Mon … 7=Sun (ERD.md §1.1), no duplicates.
  workDays: z
    .string()
    .regex(/^[1-7](,[1-7]){0,6}$/, 'Expected comma-separated ISO weekdays 1-7')
    .refine((value) => {
      const days = value.split(',');
      return new Set(days).size === days.length;
    }, 'workDays must not contain duplicate weekdays'),
  isCrossDay: z.boolean(),
  isActive: z.boolean().optional(),
});
