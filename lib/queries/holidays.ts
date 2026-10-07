import { sql, NotFoundError } from '../db';

// holidays: platform CMS (org_id IS NULL, national) + tenant CMS (org_id = this org,
// company holidays) in one table (ERD.md §1). The tenant-scoped functions below never
// take org_id as NULL from a caller — a tenant can only ever write/delete its own rows.
// The *National* functions are the platform-CMS counterparts (app/api/platform/holidays):
// org_id is always NULL there, never a caller-supplied value.

export interface HolidaySummary {
  id: number;
  orgId: number | null;
  holidayDate: string;
  name: string;
  isCollectiveLeave: boolean;
  createdAt: string;
}

const SUMMARY_COLUMNS = `
  id, org_id as "orgId", holiday_date as "holidayDate", name,
  is_collective_leave as "isCollectiveLeave", created_at as "createdAt"
`;

export interface ListHolidaysFilter {
  year?: number;
}

/** National (org_id IS NULL) + this org's own holidays, optionally narrowed to one year. */
export async function listHolidays(orgId: number, filter: ListHolidaysFilter = {}): Promise<HolidaySummary[]> {
  const conditions = ['(org_id = $1 OR org_id IS NULL)'];
  const params: unknown[] = [orgId];
  if (filter.year !== undefined) {
    params.push(`${filter.year}-01-01`);
    conditions.push(`holiday_date >= $${params.length}`);
    params.push(`${filter.year + 1}-01-01`);
    conditions.push(`holiday_date < $${params.length}`);
  }
  const rows = await sql.query(
    `SELECT ${SUMMARY_COLUMNS}
       FROM holidays
      WHERE ${conditions.join(' AND ')}
      ORDER BY holiday_date`,
    params,
  );
  return rows as HolidaySummary[];
}

/** Platform CMS listing: national holidays only (`org_id IS NULL`), optionally narrowed to one year. */
export async function listNationalHolidays(filter: ListHolidaysFilter = {}): Promise<HolidaySummary[]> {
  const conditions = ['org_id IS NULL'];
  const params: unknown[] = [];
  if (filter.year !== undefined) {
    params.push(`${filter.year}-01-01`);
    conditions.push(`holiday_date >= $${params.length}`);
    params.push(`${filter.year + 1}-01-01`);
    conditions.push(`holiday_date < $${params.length}`);
  }
  const rows = await sql.query(
    `SELECT ${SUMMARY_COLUMNS}
       FROM holidays
      WHERE ${conditions.join(' AND ')}
      ORDER BY holiday_date`,
    params,
  );
  return rows as HolidaySummary[];
}

export interface InsertCompanyHolidayInput {
  holidayDate: string;
  name: string;
  isCollectiveLeave: boolean;
}

/** A tenant can only ever insert its own (org_id = this org) holiday, never a national one. */
export async function insertCompanyHoliday(orgId: number, input: InsertCompanyHolidayInput): Promise<HolidaySummary> {
  const rows = await sql.query(
    `INSERT INTO holidays (org_id, holiday_date, name, is_collective_leave)
     VALUES ($1,$2,$3,$4)
     RETURNING ${SUMMARY_COLUMNS}`,
    [orgId, input.holidayDate, input.name, input.isCollectiveLeave],
  );
  return rows[0] as HolidaySummary;
}

export interface InsertNationalHolidayInput {
  holidayDate: string;
  name: string;
  isCollectiveLeave: boolean;
}

/** Platform CMS write: same shape as the tenant insert, but org_id is always NULL. */
export async function insertNationalHoliday(input: InsertNationalHolidayInput): Promise<HolidaySummary> {
  const rows = await sql.query(
    `INSERT INTO holidays (org_id, holiday_date, name, is_collective_leave)
     VALUES (NULL, $1, $2, $3)
     RETURNING ${SUMMARY_COLUMNS}`,
    [input.holidayDate, input.name, input.isCollectiveLeave],
  );
  return rows[0] as HolidaySummary;
}

/** Hard delete is fine (small reference rows) but org_id in the WHERE keeps a tenant off national/other-org rows. */
export async function deleteCompanyHolidayInOrg(orgId: number, id: number): Promise<void> {
  const rows = await sql.query(`DELETE FROM holidays WHERE id = $1 AND org_id = $2 RETURNING id`, [id, orgId]);
  if (rows.length === 0) throw new NotFoundError('Holiday not found');
}

/** Platform CMS delete. `org_id IS NULL` keeps this off a tenant's own company holidays. */
export async function deleteNationalHoliday(id: number): Promise<void> {
  const rows = await sql.query(`DELETE FROM holidays WHERE id = $1 AND org_id IS NULL RETURNING id`, [id]);
  if (rows.length === 0) throw new NotFoundError('Holiday not found');
}

/**
 * Used by the close-day cron (ERD.md §3.2: tracked users with no log get HOLIDAY instead
 * of ABSENT on these dates) and by check-in, where a holiday never blocks clocking in.
 */
export async function isHoliday(orgId: number, dateStr: string): Promise<boolean> {
  const rows = await sql.query(
    `SELECT 1 FROM holidays WHERE holiday_date = $2 AND (org_id = $1 OR org_id IS NULL) LIMIT 1`,
    [orgId, dateStr],
  );
  return rows.length > 0;
}
