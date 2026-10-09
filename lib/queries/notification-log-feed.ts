import { sql } from '../db';
import type { NotificationChannel, NotificationLogStatus } from '../constants/statuses';

// Read model for /app/log-notifikasi. It lives beside lib/queries/notification-logs.ts (which owns
// the writes and the platform-wide view) because the page needs things that file's list does not
// return on purpose: the event of the template, the recipient's name, and NO payload JSON. Rows are
// data, not copy: the raw `error` text is returned only so the page can turn it into a reason
// (lib/insights/notification-failure.ts); it is never rendered.

export interface NotificationFeedRow {
  id: number;
  channel: NotificationChannel;
  /** Raw address / number. The page masks it (lib/insights/mask.ts) before it is shown. */
  recipient: string;
  status: NotificationLogStatus;
  /** Raw failure text; never shown to the user. */
  error: string | null;
  createdAt: string;
  eventTrigger: string | null;
  userName: string | null;
}

export interface NotificationStatusCounts {
  total: number;
  sent: number;
  failed: number;
  queued: number;
}

function toIso(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** All-time counts per status for the filter tabs. Tenant history, newest data first by index. */
export async function getNotificationStatusCounts(orgId: number): Promise<NotificationStatusCounts> {
  const rows = await sql.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'SENT')::int AS sent,
            count(*) FILTER (WHERE status = 'FAILED')::int AS failed,
            count(*) FILTER (WHERE status = 'QUEUED')::int AS queued
       FROM notification_logs
      WHERE org_id = $1`,
    [orgId],
  );
  const r = (rows[0] ?? {}) as Record<string, unknown>;
  return { total: Number(r.total ?? 0), sent: Number(r.sent ?? 0), failed: Number(r.failed ?? 0), queued: Number(r.queued ?? 0) };
}

export interface ListNotificationFeedOptions {
  status?: NotificationLogStatus;
  page: number;
  pageSize: number;
}

/** One page of the org's log, newest first (idx_notif_logs_org). `status` narrows it. */
export async function listNotificationFeed(orgId: number, options: ListNotificationFeedOptions): Promise<NotificationFeedRow[]> {
  const params: unknown[] = [orgId];
  let where = '';
  if (options.status) {
    params.push(options.status);
    where = ` AND nl.status = $${params.length}`;
  }
  params.push(options.pageSize, Math.max(0, (options.page - 1) * options.pageSize));
  const rows = await sql.query(
    `SELECT nl.id, nl.channel, nl.recipient, nl.status, nl.error, nl.created_at AS "createdAt",
            t.event_trigger AS "eventTrigger", u.name AS "userName"
       FROM notification_logs nl
       LEFT JOIN notification_templates t ON t.id = nl.template_id
       LEFT JOIN users u ON u.id = nl.user_id AND u.org_id = nl.org_id
      WHERE nl.org_id = $1${where}
      ORDER BY nl.created_at DESC, nl.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    channel: r.channel as NotificationChannel,
    recipient: String(r.recipient ?? ''),
    status: r.status as NotificationLogStatus,
    error: r.error === null || r.error === undefined ? null : String(r.error),
    createdAt: toIso(r.createdAt),
    eventTrigger: r.eventTrigger === null || r.eventTrigger === undefined ? null : String(r.eventTrigger),
    userName: r.userName === null || r.userName === undefined ? null : String(r.userName),
  }));
}
