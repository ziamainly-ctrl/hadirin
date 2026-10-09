import { sql, NotFoundError } from '../db';
import type { BranchLocation } from '../geo';

// branches: tenant master data (ERD.md §1), edited in /app by OWNER/ADMIN (AGENTS.md).
// latitude/longitude are NUMERIC(9,6) — the driver returns them as strings, so every
// row is mapped through mapBranchRow() to give callers real numbers.

export interface BranchSummary {
  id: number;
  orgId: number;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusM: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const SUMMARY_COLUMNS = `
  id, org_id as "orgId", name, address, latitude, longitude, radius_m as "radiusM",
  is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
`;

/** Raw row shape before latitude/longitude are coerced from the driver's NUMERIC strings. */
type BranchRow = Omit<BranchSummary, 'latitude' | 'longitude'> & { latitude: string; longitude: string };

function mapBranchRow(row: BranchRow): BranchSummary {
  return { ...row, latitude: Number(row.latitude), longitude: Number(row.longitude) };
}

/** Billing cron downgrade check (TRD.md §9 step 5) — active branches count toward `plans.max_branches`. */
export async function countActiveBranches(orgId: number): Promise<number> {
  const rows = await sql.query(`SELECT count(*)::int as n FROM branches WHERE org_id = $1 AND is_active = TRUE`, [
    orgId,
  ]);
  return (rows[0] as { n: number }).n;
}

export interface ListBranchesFilter {
  activeOnly?: boolean;
}

export async function listBranches(orgId: number, filter: ListBranchesFilter = {}): Promise<BranchSummary[]> {
  const conditions = ['org_id = $1'];
  const params: unknown[] = [orgId];
  if (filter.activeOnly) {
    conditions.push('is_active = TRUE');
  }
  const rows = await sql.query(
    `SELECT ${SUMMARY_COLUMNS}
       FROM branches
      WHERE ${conditions.join(' AND ')}
      ORDER BY name`,
    params,
  );
  return (rows as BranchRow[]).map(mapBranchRow);
}

export async function getBranchByIdInOrg(orgId: number, id: number): Promise<BranchSummary> {
  const rows = await sql.query(
    `SELECT ${SUMMARY_COLUMNS} FROM branches WHERE id = $1 AND org_id = $2 LIMIT 1`,
    [id, orgId],
  );
  const row = rows[0] as BranchRow | undefined;
  if (!row) throw new NotFoundError('Cabang tidak ditemukan');
  return mapBranchRow(row);
}

export interface InsertBranchInput {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusM: number;
}

export async function insertBranch(orgId: number, input: InsertBranchInput): Promise<BranchSummary> {
  const rows = await sql.query(
    `INSERT INTO branches (org_id, name, address, latitude, longitude, radius_m)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${SUMMARY_COLUMNS}`,
    [orgId, input.name, input.address, input.latitude, input.longitude, input.radiusM],
  );
  return mapBranchRow(rows[0] as BranchRow);
}

export interface UpdateBranchInput {
  name?: string;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
  isActive?: boolean;
}

const UPDATABLE_COLUMNS: Record<keyof UpdateBranchInput, string> = {
  name: 'name',
  address: 'address',
  latitude: 'latitude',
  longitude: 'longitude',
  radiusM: 'radius_m',
  isActive: 'is_active',
};

export async function updateBranchInOrg(orgId: number, id: number, input: UpdateBranchInput): Promise<BranchSummary> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS) as [keyof UpdateBranchInput, string][]) {
    if (key in input) {
      params.push(input[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return getBranchByIdInOrg(orgId, id);
  sets.push('updated_at = now()');
  params.push(id, orgId);
  const rows = await sql.query(
    `UPDATE branches SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND org_id = $${params.length}
     RETURNING ${SUMMARY_COLUMNS}`,
    params,
  );
  const row = rows[0] as BranchRow | undefined;
  if (!row) throw new NotFoundError('Cabang tidak ditemukan');
  return mapBranchRow(row);
}

/**
 * TRD.md §6: "DELETE of a branch/shift that has history only sets is_active = false."
 * A branch referenced by any attendance_logs row (as the check-in or check-out branch)
 * is kept and deactivated instead of hard-deleted, so past logs never dangle.
 */
export async function deactivateBranchInOrg(orgId: number, id: number): Promise<void> {
  const refRows = await sql.query(
    `SELECT 1 FROM attendance_logs
      WHERE org_id = $1 AND (check_in_branch_id = $2 OR check_out_branch_id = $2)
      LIMIT 1`,
    [orgId, id],
  );
  if (refRows.length > 0) {
    const rows = await sql.query(
      `UPDATE branches SET is_active = FALSE, updated_at = now() WHERE id = $1 AND org_id = $2 RETURNING id`,
      [id, orgId],
    );
    if (rows.length === 0) throw new NotFoundError('Cabang tidak ditemukan');
    return;
  }
  const rows = await sql.query(`DELETE FROM branches WHERE id = $1 AND org_id = $2 RETURNING id`, [id, orgId]);
  if (rows.length === 0) throw new NotFoundError('Cabang tidak ditemukan');
}

/**
 * Minimal shape for the check-in flow's `nearestBranch()` (lib/geo.ts). Numbers, not
 * NUMERIC strings — see the module comment.
 */
export async function listActiveBranchesForGeofence(orgId: number): Promise<BranchLocation[]> {
  const rows = await sql.query(
    `SELECT id, latitude, longitude, radius_m as "radiusM"
       FROM branches
      WHERE org_id = $1 AND is_active = TRUE`,
    [orgId],
  );
  return (rows as { id: number; latitude: string; longitude: string; radiusM: number }[]).map((row) => ({
    id: row.id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusM: row.radiusM,
  }));
}
