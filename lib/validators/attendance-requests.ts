import { z } from 'zod';
import { dateStringSchema, timeStringSchema, blobUrlSchema } from './common';
import { REQUEST_TYPES } from '../constants/statuses';

// POST /api/attendance-requests (TRD.md §6, §8).
export const createRequestSchema = z
  .object({
    type: z.enum(REQUEST_TYPES),
    dateFrom: dateStringSchema,
    dateTo: dateStringSchema,
    requestedCheckIn: timeStringSchema.optional(),
    requestedCheckOut: timeStringSchema.optional(),
    reason: z.string().trim().min(1).max(500),
    attachmentUrl: blobUrlSchema.optional(),
  })
  // Mirrors ck_requests_range (date strings are YYYY-MM-DD, so lexicographic
  // comparison is also chronological comparison).
  .refine((data) => data.dateTo >= data.dateFrom, {
    message: 'Tanggal selesai harus sama dengan atau setelah tanggal mulai.',
    path: ['dateTo'],
  })
  // Mirrors ck_requests_correction_single_day.
  .refine((data) => data.type !== 'CORRECTION' || data.dateTo === data.dateFrom, {
    message: 'Koreksi absensi hanya untuk satu tanggal.',
    path: ['dateTo'],
  });

// PATCH /api/attendance-requests/[id] { action, note? } (TRD.md §8).
export const reviewRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(255).optional(),
});
