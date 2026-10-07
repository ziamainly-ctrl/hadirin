import { z } from 'zod';
import { GEOFENCE_MODES } from '../constants/statuses';

// PATCH /api/organizations (TRD.md §6: "Own org only"). planId and status are
// system-owned (billing cron, Midtrans webhook) and never accepted from a client —
// lib/queries/organizations.ts's updateOrganization() must not take them either.

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().trim().min(1).max(40).optional(),
  geofenceMode: z.enum(GEOFENCE_MODES).optional(),
  selfieRequired: z.boolean().optional(),
  // Logos may come from a bundled default asset, not only our Blob store, so this
  // is a plain URL rather than blobUrlSchema (unlike attendance photos/attachments).
  logoUrl: z.string().url().max(500).nullable().optional(),
});
