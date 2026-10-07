import { z } from 'zod';
import {
  latitudeSchema,
  longitudeSchema,
  blobUrlSchema,
  dateStringSchema,
  idParam,
  paginationSchema,
} from './common';
import { ATTENDANCE_STATUSES } from '../constants/statuses';

// Shared by POST /api/attendance/check-in and /check-out (TRD.md §7). photoUrl is
// optional here because "required unless organizations.selfie_required is false"
// depends on a row loaded at request time, which a static schema cannot know — the
// route handler enforces it after loading the org.
const punchFields = {
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  accuracyM: z.coerce.number().int().positive(),
  photoUrl: blobUrlSchema.optional(),
};

export const checkInSchema = z.object(punchFields);
export const checkOutSchema = z.object(punchFields);

// GET /api/attendance query params (TRD.md §6).
export const listAttendanceQuerySchema = paginationSchema.extend({
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
  branchId: idParam.optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  userId: idParam.optional(),
});
