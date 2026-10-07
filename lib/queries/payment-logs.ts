import { sql } from '../db';
import type { PaymentLogDirection } from '../constants/statuses';

export interface PaymentLog {
  id: number;
  invoiceId: number;
  direction: PaymentLogDirection;
  endpoint: string | null;
  requestPayload: unknown;
  responsePayload: unknown;
  httpStatus: number | null;
  createdAt: string;
}

const PAYMENT_LOG_COLUMNS = `
  id, invoice_id as "invoiceId", direction, endpoint, request_payload as "requestPayload",
  response_payload as "responsePayload", http_status as "httpStatus", created_at as "createdAt"
`;

export interface InsertPaymentLogInput {
  invoiceId: number;
  direction: PaymentLogDirection;
  endpoint: string | null;
  requestPayload: unknown;
  responsePayload: unknown;
  httpStatus: number | null;
}

/**
 * `requestPayload`/`responsePayload` are JSONB — pass JS objects straight through as query
 * params. The Neon driver serializes them; do not `JSON.stringify` them here, or the column
 * would end up holding a JSON string instead of a JSON object.
 */
export async function insertPaymentLog(input: InsertPaymentLogInput): Promise<PaymentLog> {
  const rows = await sql.query(
    `INSERT INTO payment_logs (invoice_id, direction, endpoint, request_payload, response_payload, http_status)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${PAYMENT_LOG_COLUMNS}`,
    [input.invoiceId, input.direction, input.endpoint, input.requestPayload, input.responsePayload, input.httpStatus],
  );
  return rows[0] as PaymentLog;
}

/** Admin debugging view: every REQUEST/WEBHOOK log for one invoice, newest first. */
export async function listPaymentLogsForInvoice(invoiceId: number): Promise<PaymentLog[]> {
  const rows = await sql.query(
    `SELECT ${PAYMENT_LOG_COLUMNS}
       FROM payment_logs
      WHERE invoice_id = $1
      ORDER BY created_at DESC`,
    [invoiceId],
  );
  return rows as PaymentLog[];
}
