import { sql } from '../db';
import type { NotificationChannel, NotificationLogStatus } from '../constants/statuses';

export interface NotificationLog {
  id: number;
  orgId: number;
  templateId: number | null;
  userId: number | null;
  attendanceLogId: number | null;
  attendanceRequestId: number | null;
  invoiceId: number | null;
  channel: NotificationChannel;
  recipient: string;
  requestPayload: unknown;
  responsePayload: unknown;
  status: NotificationLogStatus;
  error: string | null;
  createdAt: string;
}

const LOG_COLUMNS = `
  id, org_id as "orgId", template_id as "templateId", user_id as "userId",
  attendance_log_id as "attendanceLogId", attendance_request_id as "attendanceRequestId",
  invoice_id as "invoiceId", channel, recipient, request_payload as "requestPayload",
  response_payload as "responsePayload", status, error, created_at as "createdAt"
`;

export interface InsertNotificationLogInput {
  orgId: number;
  templateId?: number | null;
  userId?: number | null;
  attendanceLogId?: number | null;
  attendanceRequestId?: number | null;
  invoiceId?: number | null;
  channel: NotificationChannel;
  recipient: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  status: NotificationLogStatus;
  error?: string | null;
}

/**
 * Writes the outcome of one send attempt. Called right after notify.ts attempts to
 * send, so `status` is normally already 'SENT' or 'FAILED' — this app sends
 * synchronously and never queues ('QUEUED' is a valid value in the set but unused here).
 * `requestPayload`/`responsePayload` are stringified explicitly so an array-shaped
 * payload is never mistaken for a Postgres array literal by the driver's parameter
 * encoding; Postgres then casts the JSON text to the jsonb column on INSERT.
 */
export async function insertNotificationLog(input: InsertNotificationLogInput): Promise<NotificationLog> {
  const rows = await sql.query(
    `INSERT INTO notification_logs (
        org_id, template_id, user_id, attendance_log_id, attendance_request_id, invoice_id,
        channel, recipient, request_payload, response_payload, status, error
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING ${LOG_COLUMNS}`,
    [
      input.orgId,
      input.templateId ?? null,
      input.userId ?? null,
      input.attendanceLogId ?? null,
      input.attendanceRequestId ?? null,
      input.invoiceId ?? null,
      input.channel,
      input.recipient,
      input.requestPayload != null ? JSON.stringify(input.requestPayload) : null,
      input.responsePayload != null ? JSON.stringify(input.responsePayload) : null,
      input.status,
      input.error ?? null,
    ],
  );
  return rows[0] as NotificationLog;
}

export interface ListNotificationLogsOptions {
  limit?: number;
}

/** Tenant history, newest first. Matches idx_notif_logs_org (org_id, created_at DESC). */
export async function listNotificationLogsForOrg(
  orgId: number,
  options: ListNotificationLogsOptions = {},
): Promise<NotificationLog[]> {
  const limit = options.limit ?? 100;
  const rows = await sql.query(
    `SELECT ${LOG_COLUMNS}
       FROM notification_logs
      WHERE org_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [orgId, limit],
  );
  return rows as NotificationLog[];
}

/**
 * Platform-wide ops/debug view across every tenant — intentionally not org-scoped
 * (same "separate session kind" exception as the rest of the `/platform` surface,
 * TRD.md §6/§11). Matches the partial index idx_notif_logs_failed
 * (created_at) WHERE status = 'FAILED'.
 */
export async function listFailedNotificationLogs(): Promise<NotificationLog[]> {
  const rows = await sql.query(
    `SELECT ${LOG_COLUMNS}
       FROM notification_logs
      WHERE status = 'FAILED'
      ORDER BY created_at DESC
      LIMIT 200`,
    [],
  );
  return rows as NotificationLog[];
}
