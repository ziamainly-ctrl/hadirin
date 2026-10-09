import { z } from 'zod';
import { timeStringSchema } from './common';

// Shared by POST /api/shifts and PATCH /api/shifts/[id] (TRD.md §6).

export const upsertShiftSchema = z.object({
  name: z.string().trim().min(1).max(60),
  timeIn: timeStringSchema,
  timeOut: timeStringSchema,
  // A break longer than 8 h or a tolerance longer than 3 h is a typo, and either makes the late/work-minute maths meaningless.
  breakMinutes: z.coerce.number().int().min(0).max(480),
  lateToleranceMinutes: z.coerce.number().int().min(0).max(180),
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
})
  // The late and work-minute maths take the check-out as the next day when is_cross_day is set, so a flag
  // that disagrees with the two times (22:00-06:00 unflagged, or 08:00-17:00 flagged) corrupts every row
  // written with that shift. The message lands on timeOut because that is the field the form shows.
  .superRefine((shift, ctx) => {
    const timeIn = shift.timeIn.slice(0, 5);
    const timeOut = shift.timeOut.slice(0, 5);
    const message =
      timeIn === timeOut
        ? 'Jam keluar tidak boleh sama dengan jam masuk.'
        : timeOut < timeIn && !shift.isCrossDay
          ? 'Jam keluar lebih awal dari jam masuk. Centang "Shift lintas hari" bila jam keluar jatuh di hari berikutnya.'
          : timeOut > timeIn && shift.isCrossDay
            ? 'Jam keluar lebih akhir dari jam masuk. Matikan "Shift lintas hari" bila selesai di hari yang sama.'
            : null;
    if (message) ctx.addIssue({ code: 'custom', path: ['timeOut'], message });
  });
