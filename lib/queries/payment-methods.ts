import { sql, rawSql, NotFoundError } from '../db';
import type { PaymentMethodType, PaymentMethodCode } from '../constants/statuses';

// payment_methods = Platform CMS, global data with no org_id (ERD.md §1) — only a platform
// admin writes these rows (`/api/platform/payment-methods`), cached 1h in Upstash and busted
// on write at the route layer (TRD.md §10, cacheKeys.paymentMethodsActive). Pure SQL only.

/** Platform CMS row. The billing page needs every column, including the fee, before checkout (TRD.md §9). */
export interface PaymentMethod {
  id: number;
  code: PaymentMethodCode;
  name: string;
  type: PaymentMethodType;
  logoUrl: string | null;
  adminFeeFlat: number;
  adminFeePct: number;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

const PAYMENT_METHOD_COLUMNS = `
  id, code, name, type, logo_url as "logoUrl", admin_fee_flat as "adminFeeFlat",
  admin_fee_pct as "adminFeePct", is_active as "isActive", sort_order as "sortOrder",
  updated_at as "updatedAt"
`;

/** Billing page picker — "list active payment_methods ... with each method's fee" (TRD.md §9 step 1). */
export async function listActivePaymentMethods(): Promise<PaymentMethod[]> {
  const rows = await sql.query(
    `SELECT ${PAYMENT_METHOD_COLUMNS} FROM payment_methods WHERE is_active = TRUE ORDER BY sort_order, id`,
    [],
  );
  return rows as PaymentMethod[];
}

/** Looked up by Midtrans `enabled_payments` code at checkout (TRD.md §9 step 2) and webhook time. */
export async function getPaymentMethodByCode(code: string): Promise<PaymentMethod | null> {
  const rows = await sql.query(
    `SELECT ${PAYMENT_METHOD_COLUMNS} FROM payment_methods WHERE code = $1 LIMIT 1`,
    [code],
  );
  return (rows[0] as PaymentMethod | undefined) ?? null;
}

/** Platform CMS listing, including inactive methods (`/api/platform/payment-methods`). */
export async function listAllPaymentMethods(): Promise<PaymentMethod[]> {
  const rows = await sql.query(`SELECT ${PAYMENT_METHOD_COLUMNS} FROM payment_methods ORDER BY sort_order, id`, []);
  return rows as PaymentMethod[];
}

/** Checkout needs the chosen method's fee (TRD.md §9 step 2) — also used by updatePaymentMethod()'s empty-patch shortcut. */
export async function getPaymentMethodById(id: number): Promise<PaymentMethod | null> {
  const rows = await sql.query(
    `SELECT ${PAYMENT_METHOD_COLUMNS} FROM payment_methods WHERE id = $1 LIMIT 1`,
    [id],
  );
  return (rows[0] as PaymentMethod | undefined) ?? null;
}

export interface CreatePaymentMethodInput {
  code: PaymentMethodCode;
  name: string;
  type: PaymentMethodType;
  logoUrl?: string | null;
  adminFeeFlat?: number;
  adminFeePct?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createPaymentMethod(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
  const rows = await sql.query(
    `INSERT INTO payment_methods (code, name, type, logo_url, admin_fee_flat, admin_fee_pct, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING ${PAYMENT_METHOD_COLUMNS}`,
    [
      input.code,
      input.name,
      input.type,
      input.logoUrl ?? null,
      input.adminFeeFlat ?? 0,
      input.adminFeePct ?? 0,
      input.isActive ?? true,
      input.sortOrder ?? 0,
    ],
  );
  return rows[0] as PaymentMethod;
}

export interface UpdatePaymentMethodInput {
  code?: PaymentMethodCode;
  name?: string;
  type?: PaymentMethodType;
  logoUrl?: string | null;
  adminFeeFlat?: number;
  adminFeePct?: number;
  isActive?: boolean;
  sortOrder?: number;
}

const UPDATABLE_COLUMNS: Record<keyof UpdatePaymentMethodInput, string> = {
  code: 'code',
  name: 'name',
  type: 'type',
  logoUrl: 'logo_url',
  adminFeeFlat: 'admin_fee_flat',
  adminFeePct: 'admin_fee_pct',
  isActive: 'is_active',
  sortOrder: 'sort_order',
};

export async function updatePaymentMethod(id: number, input: UpdatePaymentMethodInput): Promise<PaymentMethod> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS) as [keyof UpdatePaymentMethodInput, string][]) {
    if (key in input) {
      params.push(input[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) {
    const row = await getPaymentMethodById(id);
    if (!row) throw new NotFoundError('Payment method not found');
    return row;
  }
  sets.push('updated_at = now()');
  params.push(id);
  const rows = await sql.query(
    `UPDATE payment_methods SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING ${PAYMENT_METHOD_COLUMNS}`,
    params,
  );
  const row = rows[0] as PaymentMethod | undefined;
  if (!row) throw new NotFoundError('Payment method not found');
  return row;
}

/** Platform CMS drag-reorder — sets `sort_order` to each id's position, in one HTTP transaction. */
export async function reorderPaymentMethods(idsInOrder: number[]): Promise<void> {
  if (idsInOrder.length === 0) return;
  // rawSql (not the coercing `sql` wrapper) — .transaction()'s array elements must be
  // the driver's own lazy query-builder objects; this result is discarded anyway (void).
  await rawSql.transaction(
    idsInOrder.map((id, position) =>
      rawSql.query(`UPDATE payment_methods SET sort_order = $1, updated_at = now() WHERE id = $2`, [position, id]),
    ),
  );
}
