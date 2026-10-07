// Render + send + log, the single entrypoint route handlers call after a check-in
// (LATE_CHECK_IN), a request submission/review, or a billing event (TRD.md §4 folder
// structure, §7 step "k. after(): LATE → notify manager", §8 "Notification recipients").
//
// Fire-and-forget by design: callers invoke this from inside Next's `after()` (TRD.md §2
// architecture diagram), once the HTTP response has already gone out, so `notify()` itself
// must never throw and never leaves the caller waiting on a flaky SMTP/WhatsApp call.
import nodemailer from 'nodemailer';
import type { NotificationEventTrigger } from './constants/events';
import type { NotificationChannel, NotificationLogStatus } from './constants/statuses';
// getEffectiveTemplate resolves org override -> global default and already applies
// is_active (lib/queries/notification-templates.ts). insertNotificationLog writes one
// notification_logs row per attempt (lib/queries/notification-logs.ts).
import { getEffectiveTemplate, type NotificationTemplate } from './queries/notification-templates';
import { insertNotificationLog } from './queries/notification-logs';

export interface NotifyInput {
  orgId: number;
  eventTrigger: NotificationEventTrigger;
  channel: NotificationChannel;
  /** FK is nullable in notification_logs (ERD.md §3) — null for a recipient with no user row. */
  recipientUserId: number | null;
  /** Email address or E.164 phone, depending on `channel`. */
  recipientAddress: string;
  /** `{{placeholder}}` values for the template body/subject. */
  variables: Record<string, string>;
  relatedAttendanceLogId?: number | null;
  relatedRequestId?: number | null;
  relatedInvoiceId?: number | null;
}

export interface NotifyResult {
  status: NotificationLogStatus;
  error?: string;
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? '');
}

async function sendEmail(input: { to: string; subject: string; html: string }): Promise<unknown> {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transport.sendMail({
    from: process.env.MAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}

async function sendWhatsApp(input: { to: string; message: string }): Promise<unknown> {
  // WA_GATEWAY_URL/TOKEN are P1/optional (TRD.md §16) — an unconfigured gateway is a normal,
  // expected state in most environments, not a bug, so this is a plain failure, not a throw
  // that escapes this helper uncaught.
  const url = process.env.WA_GATEWAY_URL;
  if (!url) {
    throw new Error('WhatsApp gateway not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.WA_GATEWAY_TOKEN ?? ''}`,
    },
    body: JSON.stringify({ to: input.to, message: input.message }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`WhatsApp gateway responded ${response.status}`);
  }
  return payload;
}

/**
 * Renders the effective template for `(orgId, eventTrigger, channel)`, sends it, and logs
 * the attempt. Returns `null` only when nothing was attempted at all (no template, or an
 * inactive one) — there is nothing to log in that case. This function never throws: a send
 * failure becomes a `FAILED` notification_logs row, not an unhandled rejection in the
 * caller's `after()`.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult | null> {
  let template: NotificationTemplate | null;
  try {
    template = await getEffectiveTemplate(input.orgId, input.eventTrigger, input.channel);
  } catch (err) {
    // A lookup failure means nothing was attempted either — fail the same way as "no
    // template" rather than risk throwing into the caller's after().
    console.error('notify: getEffectiveTemplate failed', err);
    return null;
  }

  if (!template || !template.isActive) {
    return null;
  }

  const renderedSubject = template.subject ? renderTemplate(template.subject, input.variables) : null;
  const renderedBody = renderTemplate(template.body, input.variables);

  let status: NotificationLogStatus = 'SENT';
  let error: string | null = null;
  let responsePayload: unknown = null;

  try {
    responsePayload =
      input.channel === 'EMAIL'
        ? await sendEmail({ to: input.recipientAddress, subject: renderedSubject ?? '', html: renderedBody })
        : await sendWhatsApp({ to: input.recipientAddress, message: renderedBody });
  } catch (err) {
    status = 'FAILED';
    error = err instanceof Error ? err.message : String(err);
  }

  try {
    await insertNotificationLog({
      orgId: input.orgId,
      templateId: template.id,
      userId: input.recipientUserId,
      attendanceLogId: input.relatedAttendanceLogId ?? null,
      attendanceRequestId: input.relatedRequestId ?? null,
      invoiceId: input.relatedInvoiceId ?? null,
      channel: input.channel,
      recipient: input.recipientAddress,
      requestPayload: input.variables,
      responsePayload,
      status,
      error,
    });
  } catch (err) {
    // A logging failure must not surface either — notify() is fire-and-forget end to end.
    console.error('notify: insertNotificationLog failed', err);
  }

  return { status, error: error ?? undefined };
}
