import { sql, rawSql, NotFoundError } from '../db';
import { parsePlanFeatures, DEFAULT_PLAN_FEATURES, type PlanFeatures } from '../constants/plan-features';

// plans = Platform CMS, global data with no org_id (ERD.md §1) — only a platform admin
// writes these rows (`/api/platform/plans`), cached 1h in Upstash and busted on write at
// the route layer (TRD.md §10, cacheKeys.plansPublic). This file holds pure SQL only.

/** Platform CMS row. `features` is parsed through `parsePlanFeatures` on every read. */
export interface Plan {
  id: number;
  code: string;
  name: string;
  priceMonthly: number;
  maxEmployees: number;
  maxBranches: number;
  features: PlanFeatures;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const PLAN_COLUMNS = `
  id, code, name, price_monthly as "priceMonthly", max_employees as "maxEmployees",
  max_branches as "maxBranches", features, is_active as "isActive", sort_order as "sortOrder",
  created_at as "createdAt", updated_at as "updatedAt"
`;

type PlanRow = Omit<Plan, 'features'> & { features: unknown };

function toPlan(row: PlanRow): Plan {
  return { ...row, features: parsePlanFeatures(row.features) };
}

/** Public pricing data for the registration / upgrade picker — `is_active` only, by display order. */
export async function listActivePlans(): Promise<Plan[]> {
  const rows = await sql.query(`SELECT ${PLAN_COLUMNS} FROM plans WHERE is_active = TRUE ORDER BY sort_order, id`, []);
  return (rows as PlanRow[]).map(toPlan);
}

export async function getPlanById(id: number): Promise<Plan | null> {
  const rows = await sql.query(`SELECT ${PLAN_COLUMNS} FROM plans WHERE id = $1 LIMIT 1`, [id]);
  const row = rows[0] as PlanRow | undefined;
  return row ? toPlan(row) : null;
}

/** Used to find FREE for downgrade logic (TRD.md §9 cron) and other code-level plan lookups by code. */
export async function getPlanByCode(code: string): Promise<Plan | null> {
  const rows = await sql.query(`SELECT ${PLAN_COLUMNS} FROM plans WHERE code = $1 LIMIT 1`, [code]);
  const row = rows[0] as PlanRow | undefined;
  return row ? toPlan(row) : null;
}

/** Platform CMS listing, including inactive plans (`/api/platform/plans`). */
export async function listAllPlans(): Promise<Plan[]> {
  const rows = await sql.query(`SELECT ${PLAN_COLUMNS} FROM plans ORDER BY sort_order, id`, []);
  return (rows as PlanRow[]).map(toPlan);
}

export interface CreatePlanInput {
  code: string;
  name: string;
  priceMonthly: number;
  maxEmployees: number;
  maxBranches: number;
  /** A key omitted here defaults to false on the new plan — same as parsePlanFeatures(). */
  features?: Partial<PlanFeatures>;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createPlan(input: CreatePlanInput): Promise<Plan> {
  const rows = await sql.query(
    `INSERT INTO plans (code, name, price_monthly, max_employees, max_branches, features, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
     RETURNING ${PLAN_COLUMNS}`,
    [
      input.code,
      input.name,
      input.priceMonthly,
      input.maxEmployees,
      input.maxBranches,
      JSON.stringify(input.features ?? DEFAULT_PLAN_FEATURES),
      input.isActive ?? true,
      input.sortOrder ?? 0,
    ],
  );
  return toPlan(rows[0] as PlanRow);
}

export interface UpdatePlanInput {
  code?: string;
  name?: string;
  priceMonthly?: number;
  maxEmployees?: number;
  maxBranches?: number;
  /** Merged onto the existing row's features (not replaced) — a partial update like
   * {whatsapp_alerts: true} must not silently clear every other flag back to false. */
  features?: Partial<PlanFeatures>;
  isActive?: boolean;
  sortOrder?: number;
}

// `features` is excluded here — it needs a ::jsonb cast + JSON.stringify, handled separately below.
const UPDATABLE_COLUMNS: Record<Exclude<keyof UpdatePlanInput, 'features'>, string> = {
  code: 'code',
  name: 'name',
  priceMonthly: 'price_monthly',
  maxEmployees: 'max_employees',
  maxBranches: 'max_branches',
  isActive: 'is_active',
  sortOrder: 'sort_order',
};

export async function updatePlan(id: number, input: UpdatePlanInput): Promise<Plan> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS) as [Exclude<keyof UpdatePlanInput, 'features'>, string][]) {
    if (key in input) {
      params.push(input[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (input.features !== undefined) {
    // jsonb `||` merges onto the existing column value instead of replacing it, atomically
    // (no separate read-then-write race) — a partial update can't silently clear flags it
    // didn't mention.
    params.push(JSON.stringify(input.features));
    sets.push(`features = features || $${params.length}::jsonb`);
  }
  if (sets.length === 0) {
    const row = await getPlanById(id);
    if (!row) throw new NotFoundError('Paket tidak ditemukan');
    return row;
  }
  sets.push('updated_at = now()');
  params.push(id);
  const rows = await sql.query(
    `UPDATE plans SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${PLAN_COLUMNS}`,
    params,
  );
  const row = rows[0] as PlanRow | undefined;
  if (!row) throw new NotFoundError('Paket tidak ditemukan');
  return toPlan(row);
}

/** Platform CMS drag-reorder — sets `sort_order` to each id's position, in one HTTP transaction. */
export async function reorderPlans(idsInOrder: number[]): Promise<void> {
  if (idsInOrder.length === 0) return;
  // rawSql (not the coercing `sql` wrapper) — .transaction()'s array elements must be
  // the driver's own lazy query-builder objects; this result is discarded anyway (void).
  await rawSql.transaction(
    idsInOrder.map((id, position) =>
      rawSql.query(`UPDATE plans SET sort_order = $1, updated_at = now() WHERE id = $2`, [position, id]),
    ),
  );
}
