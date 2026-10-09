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

/** Above this the fix is useless for a geofence (a desktop browser's IP-based guess is routinely
 * kilometres off) and the punch is refused with ACCURACY_TOO_LOW (TRD.md §7). */
export const MAX_PUNCH_ACCURACY_M = 1000;
/** Above this the punch is accepted but the row is annotated (see lowAccuracyNote). */
export const WEAK_ACCURACY_NOTE_M = 150;
export const LOW_ACCURACY_NOTE = 'Akurasi GPS rendah';

const positionFields = {
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  // Capped far above MAX_PUNCH_ACCURACY_M on purpose: the route turns "too inaccurate" into the
  // named 422 ACCURACY_TOO_LOW (a message with a next step) instead of a field error.
  accuracyM: z.coerce.number().int().min(1).max(100_000),
};

// (0, 0) is "Null Island": what a broken or spoofed geolocation reports. Never a real office.
function notNullIsland(value: { latitude: number; longitude: number }): boolean {
  return !(value.latitude === 0 && value.longitude === 0);
}
const NULL_ISLAND_MESSAGE = 'Lokasi tidak valid. Perbarui lokasi lalu coba lagi.';

// Shared by POST /api/attendance/check-in and /check-out (TRD.md §7). photoUrl is
// optional here because "required unless organizations.selfie_required is false"
// depends on a row loaded at request time, which a static schema cannot know — the
// route handler enforces it after loading the org (and that the URL is this person's own
// upload for this direction, see lib/attendance-photo.ts).
const punchFields = {
  ...positionFields,
  photoUrl: blobUrlSchema.optional(),
  note: z.string().trim().max(255).optional(),
};

export const checkInSchema = z
  .object(punchFields)
  .refine(notNullIsland, { message: NULL_ISLAND_MESSAGE, path: ['latitude'] });
export const checkOutSchema = z
  .object(punchFields)
  .refine(notNullIsland, { message: NULL_ISLAND_MESSAGE, path: ['latitude'] });

// POST /api/attendance/precheck: the same position, no photo. Advisory only; the punch routes
// recompute everything.
export const precheckSchema = z
  .object(positionFields)
  .refine(notNullIsland, { message: NULL_ISLAND_MESSAGE, path: ['latitude'] });

// GET /api/attendance query params (TRD.md §6).
export const listAttendanceQuerySchema = paginationSchema.extend({
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
  branchId: idParam.optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  userId: idParam.optional(),
});

/** The note stored with a punch: the person's own note wins; otherwise a weak fix is flagged so the
 * admin sees it in /app/luar-area and the attendance table. Pure, unit-tested. */
export function lowAccuracyNote(note: string | undefined | null, accuracyM: number): string | null {
  const own = note?.trim();
  if (own) return own;
  return accuracyM > WEAK_ACCURACY_NOTE_M ? LOW_ACCURACY_NOTE : null;
}
