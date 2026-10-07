import { sql } from '../db';
import type { NotificationEventTrigger } from '../constants/events';
import type { NotificationChannel } from '../constants/statuses';

// Resolution order is "org override -> global default" (ERD.md §1 Platform CMS row).
// An org override row always wins when present, even if is_active=false on it: that is
// an explicit opt-out by the org and must not silently fall back to the global template.
// Only the ABSENCE of an override row falls through to the global default.

export interface NotificationTemplate {
  id: number;
  orgId: number | null; // NULL = platform/global default (ERD.md §1.1)
  eventTrigger: NotificationEventTrigger;
  channel: NotificationChannel;
  subject: string | null; // EMAIL only; NULL for WHATSAPP
  body: string;
  isActive: boolean;
  updatedAt: string;
}

const TEMPLATE_COLUMNS = `
  id, org_id as "orgId", event_trigger as "eventTrigger", channel,
  subject, body, is_active as "isActive", updated_at as "updatedAt"
`;

/**
 * Resolves the template for one event+channel: org override first, global default
 * otherwise. Returns null when neither row exists, or when the row that would apply
 * has is_active=false.
 *
 * This is the loader a Redis-backed cache wraps under TRD.md §10's
 * `tpl:{org}:{event}:{channel}` key — it does not call Redis itself.
 */
export async function getEffectiveTemplate(
  orgId: number,
  eventTrigger: NotificationEventTrigger,
  channel: NotificationChannel,
): Promise<NotificationTemplate | null> {
  const overrideRows = await sql.query(
    `SELECT ${TEMPLATE_COLUMNS}
       FROM notification_templates
      WHERE org_id = $1 AND event_trigger = $2 AND channel = $3
      LIMIT 1`,
    [orgId, eventTrigger, channel],
  );
  const override = overrideRows[0] as NotificationTemplate | undefined;
  if (override) return override.isActive ? override : null;

  const globalRows = await sql.query(
    `SELECT ${TEMPLATE_COLUMNS}
       FROM notification_templates
      WHERE org_id IS NULL AND event_trigger = $1 AND channel = $2
      LIMIT 1`,
    [eventTrigger, channel],
  );
  const global = globalRows[0] as NotificationTemplate | undefined;
  if (!global) return null;
  return global.isActive ? global : null;
}

/** Platform CMS listing: every global default template (`org_id IS NULL`). */
export async function listGlobalTemplates(): Promise<NotificationTemplate[]> {
  const rows = await sql.query(
    `SELECT ${TEMPLATE_COLUMNS}
       FROM notification_templates
      WHERE org_id IS NULL
      ORDER BY event_trigger, channel`,
    [],
  );
  return rows as NotificationTemplate[];
}

/** Tenant CMS listing: this org's overrides only (`/app/settings/notifications`). */
export async function listOrgTemplateOverrides(orgId: number): Promise<NotificationTemplate[]> {
  const rows = await sql.query(
    `SELECT ${TEMPLATE_COLUMNS}
       FROM notification_templates
      WHERE org_id = $1
      ORDER BY event_trigger, channel`,
    [orgId],
  );
  return rows as NotificationTemplate[];
}

export interface UpsertTemplateInput {
  eventTrigger: NotificationEventTrigger;
  channel: NotificationChannel;
  subject?: string | null; // EMAIL only; leave null/omitted for WHATSAPP
  body: string;
}

/**
 * Inserts or replaces this org's override for one event+channel.
 *
 * `uq_notif_tpl_scope` is a unique index on (COALESCE(org_id, 0), event_trigger, channel)
 * (drizzle/0001_custom_constraints.sql) because org_id is nullable and two NULLs never
 * compare equal under a plain unique index. Postgres only infers an expression-based
 * unique index when the ON CONFLICT target repeats the exact same expression, so the
 * conflict target below must read `COALESCE(org_id, 0)`, not the bare column — plain
 * `ON CONFLICT (org_id, event_trigger, channel)` fails at runtime with "there is no
 * unique or exclusion constraint matching the ON CONFLICT specification" since no such
 * plain-column index exists.
 */
export async function upsertOrgTemplateOverride(
  orgId: number,
  input: UpsertTemplateInput,
): Promise<NotificationTemplate> {
  const rows = await sql.query(
    `INSERT INTO notification_templates (org_id, event_trigger, channel, subject, body)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (COALESCE(org_id, 0), event_trigger, channel)
     DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now()
     RETURNING ${TEMPLATE_COLUMNS}`,
    [orgId, input.eventTrigger, input.channel, input.subject ?? null, input.body],
  );
  return rows[0] as NotificationTemplate;
}

/** Platform CMS write: same shape as the org override, but org_id is always NULL. */
export async function upsertGlobalTemplate(input: UpsertTemplateInput): Promise<NotificationTemplate> {
  const rows = await sql.query(
    `INSERT INTO notification_templates (org_id, event_trigger, channel, subject, body)
     VALUES (NULL, $1, $2, $3, $4)
     ON CONFLICT (COALESCE(org_id, 0), event_trigger, channel)
     DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now()
     RETURNING ${TEMPLATE_COLUMNS}`,
    [input.eventTrigger, input.channel, input.subject ?? null, input.body],
  );
  return rows[0] as NotificationTemplate;
}
