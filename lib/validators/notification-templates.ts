import { z } from 'zod';
import { NOTIFICATION_EVENT_TRIGGERS } from '../constants/events';
import { NOTIFICATION_CHANNELS } from '../constants/statuses';

// PATCH /api/notification-templates/[id] (tenant override; needs
// features.template_override) and the platform CRUD counterpart (TRD.md §6).
export const upsertTemplateSchema = z.object({
  eventTrigger: z.enum(NOTIFICATION_EVENT_TRIGGERS),
  channel: z.enum(NOTIFICATION_CHANNELS),
  // EMAIL only (ERD.md §3 column comment); irrelevant for WHATSAPP.
  subject: z.string().trim().max(200).optional(),
  // TEXT column — no max. EMAIL: HTML from Tiptap; WHATSAPP: plain text.
  body: z.string().min(1),
});
