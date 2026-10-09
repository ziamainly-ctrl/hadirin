import { sql, NotFoundError, type TxClient } from '../db';
import type { OrgStatus, GeofenceMode } from '../constants/statuses';
import { parsePlanFeatures, type PlanFeatures } from '../constants/plan-features';

// organizations = Tenant CMS: each org edits only its OWN row, via /app, OWNER/ADMIN only
// (ERD.md §1). plan_id/status/trial_ends_at/plan_expires_at are system/billing-owned —
// only the registration flow (insert) and the billing cron/webhook (TRD.md §9) write them;
// updateOrganization() below must never accept them.

/** Full tenant row, all columns (`/api/organizations` GET, TRD.md §6 — "own org only"). */
export interface OrganizationRow {
  id: number;
  planId: number;
  name: string;
  slug: string;
  timezone: string;
  status: OrgStatus;
  geofenceMode: GeofenceMode;
  selfieRequired: boolean;
  logoUrl: string | null;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ORGANIZATION_COLUMNS = `
  id, plan_id as "planId", name, slug, timezone, status, geofence_mode as "geofenceMode",
  selfie_required as "selfieRequired", logo_url as "logoUrl", trial_ends_at as "trialEndsAt",
  plan_expires_at as "planExpiresAt", created_at as "createdAt", updated_at as "updatedAt"
`;

export async function getOrganizationById(orgId: number): Promise<OrganizationRow | null> {
  const rows = await sql.query(`SELECT ${ORGANIZATION_COLUMNS} FROM organizations WHERE id = $1 LIMIT 1`, [orgId]);
  return (rows[0] as OrganizationRow | undefined) ?? null;
}

/** Registration's uniqueness check (`/api/auth/register`, TRD.md §6) — look up before insert, never throws. */
export async function getOrganizationBySlug(slug: string): Promise<OrganizationRow | null> {
  const rows = await sql.query(`SELECT ${ORGANIZATION_COLUMNS} FROM organizations WHERE slug = $1 LIMIT 1`, [slug]);
  return (rows[0] as OrganizationRow | undefined) ?? null;
}

export interface InsertOrganizationInput {
  planId: number;
  name: string;
  slug: string;
  trialEndsAt: string;
}

/**
 * Registration (TRD.md §6: "Creates org (STARTER TRIAL 14 d) + OWNER in one transaction").
 * Takes the caller's withTx PoolClient directly — same convention as
 * lib/queries/attendance.ts's applyCorrectionToLog — because this always runs paired with
 * users.ts's insertUserTx inside the same transaction, never alone.
 */
export async function insertOrganizationTx(client: TxClient, input: InsertOrganizationInput): Promise<OrganizationRow> {
  const result = await client.query(
    `INSERT INTO organizations (plan_id, name, slug, status, geofence_mode, selfie_required, trial_ends_at)
     VALUES ($1, $2, $3, 'TRIAL', 'STRICT', TRUE, $4)
     RETURNING ${ORGANIZATION_COLUMNS}`,
    [input.planId, input.name, input.slug, input.trialEndsAt],
  );
  return result.rows[0] as OrganizationRow;
}

/**
 * OWNER/ADMIN-editable fields only. `planId`, `status`, `trialEndsAt` and `planExpiresAt`
 * are never settable here — those change only through billing (TRD.md §9) or the cron job.
 */
export interface UpdateOrganizationInput {
  name?: string;
  timezone?: string;
  geofenceMode?: GeofenceMode;
  selfieRequired?: boolean;
  logoUrl?: string | null;
}

const UPDATABLE_COLUMNS: Record<keyof UpdateOrganizationInput, string> = {
  name: 'name',
  timezone: 'timezone',
  geofenceMode: 'geofence_mode',
  selfieRequired: 'selfie_required',
  logoUrl: 'logo_url',
};

export async function updateOrganization(orgId: number, input: UpdateOrganizationInput): Promise<OrganizationRow> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS) as [keyof UpdateOrganizationInput, string][]) {
    if (key in input) {
      params.push(input[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) {
    const row = await getOrganizationById(orgId);
    if (!row) throw new NotFoundError('Organisasi tidak ditemukan');
    return row;
  }
  sets.push('updated_at = now()');
  params.push(orgId);
  const rows = await sql.query(
    `UPDATE organizations SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING ${ORGANIZATION_COLUMNS}`,
    params,
  );
  const row = rows[0] as OrganizationRow | undefined;
  if (!row) throw new NotFoundError('Organisasi tidak ditemukan');
  return row;
}

/**
 * Org settings joined to its plan's resolved limits/features (ERD.md §1: plans is Platform
 * CMS, cached separately from the tenant's own row). Feeds `/api/me`, and the seat
 * (`maxEmployees`), branch (`maxBranches`) and feature-flag gates on write routes.
 */
export interface OrganizationPlanContext {
  id: number;
  name: string;
  slug: string;
  timezone: string;
  status: OrgStatus;
  geofenceMode: GeofenceMode;
  selfieRequired: boolean;
  logoUrl: string | null;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  planId: number;
  planCode: string;
  planName: string;
  maxEmployees: number;
  maxBranches: number;
  features: PlanFeatures;
}

/**
 * System-only mutation for the billing webhook/cron (TRD.md §9) — deliberately separate
 * from updateOrganization(), which must never touch status/plan_expires_at.
 */
export async function activateOrgAfterPayment(orgId: number, planExpiresAt: string): Promise<void> {
  await sql.query(
    `UPDATE organizations SET status = 'ACTIVE', plan_expires_at = $2, updated_at = now() WHERE id = $1`,
    [orgId, planExpiresAt],
  );
}

export interface PlatformOrganizationRow {
  id: number;
  name: string;
  slug: string;
  status: OrgStatus;
  planId: number;
  planCode: string;
  planName: string;
  maxEmployees: number;
  seatsUsed: number;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  createdAt: string;
}

/** Platform CMS listing (PRD.md P1 "Organizations list: plan, status, seats used"). */
export async function listOrganizationsForPlatform(): Promise<PlatformOrganizationRow[]> {
  const rows = await sql.query(
    `SELECT o.id, o.name, o.slug, o.status, p.id as "planId", p.code as "planCode", p.name as "planName",
            p.max_employees as "maxEmployees",
            (SELECT count(*)::int FROM users u WHERE u.org_id = o.id AND u.status = 'ACTIVE') as "seatsUsed",
            o.trial_ends_at as "trialEndsAt", o.plan_expires_at as "planExpiresAt", o.created_at as "createdAt"
       FROM organizations o
       JOIN plans p ON p.id = o.plan_id
      ORDER BY o.created_at DESC`,
    [],
  );
  return rows as PlatformOrganizationRow[];
}

/** Close-day cron (TRD.md §12) — every org, regardless of billing status. */
export async function listAllOrgsForCron(): Promise<Pick<OrganizationRow, 'id' | 'timezone'>[]> {
  const rows = await sql.query(`SELECT id, timezone FROM organizations ORDER BY id`, []);
  return rows as Pick<OrganizationRow, 'id' | 'timezone'>[];
}

/** Billing cron (TRD.md §9 step 5): ACTIVE orgs within `days` of expiry, for the renewal invoice. */
export async function listActiveOrgsNearingExpiry(
  days: number,
): Promise<Pick<OrganizationRow, 'id' | 'planId' | 'timezone' | 'planExpiresAt'>[]> {
  const rows = await sql.query(
    `SELECT id, plan_id as "planId", timezone, plan_expires_at as "planExpiresAt" FROM organizations
      WHERE status = 'ACTIVE' AND plan_expires_at < now() + ($1 || ' days')::interval`,
    [days],
  );
  return rows as Pick<OrganizationRow, 'id' | 'planId' | 'timezone' | 'planExpiresAt'>[];
}

/** Billing cron (TRD.md §9 step 5): ACTIVE orgs whose plan has expired, due for PAST_DUE. */
export async function listActiveOrgsPastExpiry(): Promise<Pick<OrganizationRow, 'id' | 'timezone'>[]> {
  const rows = await sql.query(
    `SELECT id, timezone FROM organizations WHERE status = 'ACTIVE' AND plan_expires_at < now()`,
    [],
  );
  return rows as Pick<OrganizationRow, 'id' | 'timezone'>[];
}

/** Billing cron: TRIAL orgs whose trial has ended. */
export async function listTrialOrgsPastEnd(): Promise<Pick<OrganizationRow, 'id' | 'planId' | 'timezone'>[]> {
  const rows = await sql.query(
    `SELECT id, plan_id as "planId", timezone FROM organizations WHERE status = 'TRIAL' AND trial_ends_at < now()`,
    [],
  );
  return rows as Pick<OrganizationRow, 'id' | 'planId' | 'timezone'>[];
}

/** Billing cron: PAST_DUE orgs still unpaid after the 3-day grace period. */
export async function listPastDueOrgsBeyondGrace(graceDays: number): Promise<Pick<OrganizationRow, 'id' | 'planId' | 'timezone'>[]> {
  const rows = await sql.query(
    `SELECT id, plan_id as "planId", timezone FROM organizations
      WHERE status = 'PAST_DUE' AND plan_expires_at < now() - ($1 || ' days')::interval`,
    [graceDays],
  );
  return rows as Pick<OrganizationRow, 'id' | 'planId' | 'timezone'>[];
}

/** Billing cron: ACTIVE -> PAST_DUE transition for an expired org (before the grace window starts). */
export async function markOrgPastDue(orgId: number): Promise<void> {
  await sql.query(`UPDATE organizations SET status = 'PAST_DUE', updated_at = now() WHERE id = $1`, [orgId]);
}

/**
 * Billing cron downgrade/suspend (TRD.md §9 step 5). `fitsFreePlan` is decided by the
 * caller (seats/branches vs the FREE plan's limits) since that requires other tables
 * this file doesn't query.
 */
export async function downgradeOrSuspendOrg(orgId: number, freePlanId: number, fitsFreePlan: boolean): Promise<void> {
  if (fitsFreePlan) {
    await sql.query(
      `UPDATE organizations SET plan_id = $2, status = 'ACTIVE', plan_expires_at = NULL, updated_at = now() WHERE id = $1`,
      [orgId, freePlanId],
    );
  } else {
    await sql.query(`UPDATE organizations SET status = 'SUSPENDED', updated_at = now() WHERE id = $1`, [orgId]);
  }
}

export async function getOrganizationPlanContext(orgId: number): Promise<OrganizationPlanContext | null> {
  const rows = await sql.query(
    `SELECT o.id, o.name, o.slug, o.timezone, o.status, o.geofence_mode as "geofenceMode",
            o.selfie_required as "selfieRequired", o.logo_url as "logoUrl",
            o.trial_ends_at as "trialEndsAt", o.plan_expires_at as "planExpiresAt",
            p.id as "planId", p.code as "planCode", p.name as "planName",
            p.max_employees as "maxEmployees", p.max_branches as "maxBranches", p.features
       FROM organizations o
       JOIN plans p ON p.id = o.plan_id
      WHERE o.id = $1
      LIMIT 1`,
    [orgId],
  );
  const row = rows[0] as (Omit<OrganizationPlanContext, 'features'> & { features: unknown }) | undefined;
  if (!row) return null;
  return { ...row, features: parsePlanFeatures(row.features) };
}
