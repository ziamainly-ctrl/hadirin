import { sql, NotFoundError } from '../db';
import type { InvoiceStatus } from '../constants/statuses';

export interface Invoice {
  id: number;
  orgId: number;
  planId: number;
  paymentMethodId: number | null;
  invoiceCode: string;
  midtransOrderId: string | null;
  periodStart: string;
  periodEnd: string;
  employeeCount: number;
  amount: number;
  adminFee: number;
  totalAmount: number;
  status: InvoiceStatus;
  snapToken: string | null;
  snapRedirectUrl: string | null;
  midtransTransactionId: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const INVOICE_COLUMNS = `
  id, org_id as "orgId", plan_id as "planId", payment_method_id as "paymentMethodId",
  invoice_code as "invoiceCode", midtrans_order_id as "midtransOrderId",
  period_start as "periodStart", period_end as "periodEnd", employee_count as "employeeCount",
  amount, admin_fee as "adminFee", total_amount as "totalAmount", status,
  snap_token as "snapToken", snap_redirect_url as "snapRedirectUrl",
  midtrans_transaction_id as "midtransTransactionId", paid_at as "paidAt",
  expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
`;

export async function listInvoicesForOrg(orgId: number): Promise<Invoice[]> {
  const rows = await sql.query(
    `SELECT ${INVOICE_COLUMNS}
       FROM invoices
      WHERE org_id = $1
      ORDER BY created_at DESC`,
    [orgId],
  );
  return rows as Invoice[];
}

export async function getInvoiceByIdInOrg(orgId: number, id: number): Promise<Invoice> {
  const rows = await sql.query(
    `SELECT ${INVOICE_COLUMNS} FROM invoices WHERE id = $1 AND org_id = $2 LIMIT 1`,
    [id, orgId],
  );
  const row = rows[0] as Invoice | undefined;
  if (!row) throw new NotFoundError('Invoice not found');
  return row;
}

/** TRD.md §9 step 2: "reuse the org's PENDING invoice for the next period or create one." */
export async function getPendingInvoiceForPeriod(
  orgId: number,
  periodStart: string,
  periodEnd: string,
): Promise<Invoice | null> {
  const rows = await sql.query(
    `SELECT ${INVOICE_COLUMNS}
       FROM invoices
      WHERE org_id = $1 AND status = 'PENDING' AND period_start = $2 AND period_end = $3
      LIMIT 1`,
    [orgId, periodStart, periodEnd],
  );
  return (rows[0] as Invoice | undefined) ?? null;
}

export interface InsertInvoiceInput {
  orgId: number;
  planId: number;
  periodStart: string;
  periodEnd: string;
  employeeCount: number;
  amount: number;
  adminFee: number;
  totalAmount: number;
  invoiceCode: string;
}

/**
 * Creates the invoice shell for a billing period. `payment_method_id`, `midtrans_order_id`,
 * `snap_token` and `snap_redirect_url` are left NULL (omitted here) until checkout picks a
 * payment method via `attachMidtransCheckout` (TRD.md §9 step 2).
 */
export async function insertInvoice(input: InsertInvoiceInput): Promise<Invoice> {
  const rows = await sql.query(
    `INSERT INTO invoices (org_id, plan_id, period_start, period_end, employee_count, amount,
                            admin_fee, total_amount, invoice_code, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING')
     RETURNING ${INVOICE_COLUMNS}`,
    [
      input.orgId,
      input.planId,
      input.periodStart,
      input.periodEnd,
      input.employeeCount,
      input.amount,
      input.adminFee,
      input.totalAmount,
      input.invoiceCode,
    ],
  );
  return rows[0] as Invoice;
}

export interface AttachMidtransCheckoutInput {
  paymentMethodId: number;
  midtransOrderId: string;
  snapToken: string;
  snapRedirectUrl: string;
  /** Recomputed for the chosen method (TRD.md §9 step 2) — the fee is per-attempt, not
   * fixed at invoice creation, since a retry can pick a different payment method. */
  adminFee: number;
  totalAmount: number;
  expiresAt: string;
}

/**
 * TRD.md §9 step 2 "Start a new attempt": updates the existing PENDING invoice with a fresh
 * Midtrans order id / Snap token. Never inserts a new row — a method change on a PENDING
 * invoice gets a new `midtrans_order_id` attempt on the same invoice.
 */
export async function attachMidtransCheckout(
  invoiceId: number,
  input: AttachMidtransCheckoutInput,
): Promise<Invoice> {
  const rows = await sql.query(
    `UPDATE invoices
        SET payment_method_id = $1, midtrans_order_id = $2, snap_token = $3, snap_redirect_url = $4,
            admin_fee = $5, total_amount = $6, expires_at = $7, updated_at = now()
      WHERE id = $8 AND status = 'PENDING'
      RETURNING ${INVOICE_COLUMNS}`,
    [
      input.paymentMethodId,
      input.midtransOrderId,
      input.snapToken,
      input.snapRedirectUrl,
      input.adminFee,
      input.totalAmount,
      input.expiresAt,
      invoiceId,
    ],
  );
  const row = rows[0] as Invoice | undefined;
  if (!row) throw new NotFoundError('Pending invoice not found');
  return row;
}

/**
 * Webhook lookup (TRD.md §9 step 4) — intentionally takes no `orgId`: the Midtrans webhook
 * carries no session. The caller must not leak this row's data back to an unauthenticated
 * client and must only ever use it to mutate status fields (markInvoicePaid / markInvoiceStatus).
 */
export async function getInvoiceByMidtransOrderId(midtransOrderId: string): Promise<Invoice | null> {
  const rows = await sql.query(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE midtrans_order_id = $1 LIMIT 1`, [
    midtransOrderId,
  ]);
  return (rows[0] as Invoice | undefined) ?? null;
}

export interface MarkInvoicePaidInput {
  midtransTransactionId: string;
}

/** TRD.md §9 step 4: `settlement`, or `capture` with `fraud_status=accept`. */
export async function markInvoicePaid(invoiceId: number, input: MarkInvoicePaidInput): Promise<void> {
  const rows = await sql.query(
    `UPDATE invoices
        SET status = 'PAID', paid_at = now(), midtrans_transaction_id = $1, updated_at = now()
      WHERE id = $2
      RETURNING id`,
    [input.midtransTransactionId, invoiceId],
  );
  if (rows.length === 0) throw new NotFoundError('Invoice not found');
}

/** EXPIRED/FAILED transitions (TRD.md §9 steps 4–5). */
export async function markInvoiceStatus(invoiceId: number, status: InvoiceStatus): Promise<void> {
  const rows = await sql.query(`UPDATE invoices SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`, [
    status,
    invoiceId,
  ]);
  if (rows.length === 0) throw new NotFoundError('Invoice not found');
}

/**
 * Billing cron (TRD.md §9 step 5): PENDING invoices whose Snap attempt has expired, to be
 * transitioned to EXPIRED. No `orgId` — this scans across all tenants. Matches `idx_invoices_pending`
 * (`ON invoices (expires_at) WHERE status = 'PENDING'`).
 */
export async function listPendingInvoicesPastExpiry(): Promise<Invoice[]> {
  const rows = await sql.query(
    `SELECT ${INVOICE_COLUMNS}
       FROM invoices
      WHERE status = 'PENDING' AND expires_at < now()
      ORDER BY expires_at`,
    [],
  );
  return rows as Invoice[];
}
