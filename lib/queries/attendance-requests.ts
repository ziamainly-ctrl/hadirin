import { sql, NotFoundError } from '../db';
import type { PoolClient } from '@neondatabase/serverless';
import type { RequestType, RequestStatus } from '../constants/statuses';

// Security/correctness-critical (AGENTS.md domain rule #6 "idempotent writes... Approvals
// update only WHERE status = 'PENDING'") — written directly. Mirrors TRD.md §8 exactly.

const REQUEST_COLUMNS = `
  id, org_id as "orgId", user_id as "userId", type, date_from as "dateFrom", date_to as "dateTo",
  requested_check_in as "requestedCheckIn", requested_check_out as "requestedCheckOut",
  reason, attachment_url as "attachmentUrl", status, reviewed_by as "reviewedBy",
  reviewed_at as "reviewedAt", review_note as "reviewNote",
  created_at as "createdAt", updated_at as "updatedAt"
`;

// Same columns, `r.`-qualified — users also has id/status/created_at/updated_at columns,
// so the join in listRequestsForOrg() needs every column disambiguated, not just id.
const REQUEST_COLUMNS_QUALIFIED = `
  r.id, r.org_id as "orgId", r.user_id as "userId", r.type, r.date_from as "dateFrom", r.date_to as "dateTo",
  r.requested_check_in as "requestedCheckIn", r.requested_check_out as "requestedCheckOut",
  r.reason, r.attachment_url as "attachmentUrl", r.status, r.reviewed_by as "reviewedBy",
  r.reviewed_at as "reviewedAt", r.review_note as "reviewNote",
  r.created_at as "createdAt", r.updated_at as "updatedAt"
`;

export interface AttendanceRequestRow {
  id: number;
  orgId: number;
  userId: number;
  type: RequestType;
  dateFrom: string;
  dateTo: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  attachmentUrl: string | null;
  status: RequestStatus;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsertRequestInput {
  orgId: number;
  userId: number;
  type: RequestType;
  dateFrom: string;
  dateTo: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  attachmentUrl: string | null;
}

export async function insertRequest(input: InsertRequestInput): Promise<AttendanceRequestRow> {
  const rows = await sql.query(
    `INSERT INTO attendance_requests (org_id, user_id, type, date_from, date_to, requested_check_in,
                                        requested_check_out, reason, attachment_url, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING')
     RETURNING ${REQUEST_COLUMNS}`,
    [
      input.orgId,
      input.userId,
      input.type,
      input.dateFrom,
      input.dateTo,
      input.requestedCheckIn,
      input.requestedCheckOut,
      input.reason,
      input.attachmentUrl,
    ],
  );
  return rows[0] as AttendanceRequestRow;
}

export interface ListRequestsFilter {
  status?: RequestStatus;
  type?: RequestType;
  userId?: number;
  managerId?: number; // scope to this manager's direct reports (join users)
}

export async function listRequestsForOrg(orgId: number, filter: ListRequestsFilter = {}): Promise<AttendanceRequestRow[]> {
  const conditions = ['r.org_id = $1'];
  const params: unknown[] = [orgId];
  if (filter.status) {
    params.push(filter.status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (filter.type) {
    params.push(filter.type);
    conditions.push(`r.type = $${params.length}`);
  }
  if (filter.userId !== undefined) {
    params.push(filter.userId);
    conditions.push(`r.user_id = $${params.length}`);
  }
  let join = '';
  if (filter.managerId !== undefined) {
    params.push(filter.managerId);
    join = `JOIN users u ON u.id = r.user_id`;
    conditions.push(`u.manager_id = $${params.length}`);
  }
  const rows = await sql.query(
    `SELECT ${REQUEST_COLUMNS_QUALIFIED}
       FROM attendance_requests r ${join}
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.created_at DESC
      LIMIT 500`,
    params,
  );
  return rows as AttendanceRequestRow[];
}

export async function getRequestByIdInOrg(orgId: number, id: number): Promise<AttendanceRequestRow> {
  const rows = await sql.query(`SELECT ${REQUEST_COLUMNS} FROM attendance_requests WHERE id = $1 AND org_id = $2`, [
    id,
    orgId,
  ]);
  const row = rows[0] as AttendanceRequestRow | undefined;
  if (!row) throw new NotFoundError('Request not found');
  return row;
}

export interface RequestWithRequester extends AttendanceRequestRow {
  requesterManagerId: number | null;
  requesterShiftId: number | null;
}

/** Pre-check read used by the route BEFORE opening a transaction, to decide whether this
 * reviewer (OWNER/ADMIN any; MANAGER only their own report) is even allowed to act. */
export async function getRequestWithRequesterInOrg(orgId: number, id: number): Promise<RequestWithRequester> {
  const rows = await sql.query(
    `SELECT r.id, r.org_id as "orgId", r.user_id as "userId", r.type, r.date_from as "dateFrom",
            r.date_to as "dateTo", r.requested_check_in as "requestedCheckIn",
            r.requested_check_out as "requestedCheckOut", r.reason, r.attachment_url as "attachmentUrl",
            r.status, r.reviewed_by as "reviewedBy", r.reviewed_at as "reviewedAt",
            r.review_note as "reviewNote", r.created_at as "createdAt", r.updated_at as "updatedAt",
            u.manager_id as "requesterManagerId", u.shift_id as "requesterShiftId"
       FROM attendance_requests r
       JOIN users u ON u.id = r.user_id
      WHERE r.id = $1 AND r.org_id = $2`,
    [id, orgId],
  );
  const row = rows[0] as RequestWithRequester | undefined;
  if (!row) throw new NotFoundError('Request not found');
  return row;
}

/**
 * Atomic approve/reject (TRD.md §8 step 1): the WHERE status='PENDING' makes this safe
 * against a double-review race without a separate lock. Null = already reviewed (409).
 * Runs inside the caller's withTx, alongside applyCorrectionToLog/applyRangeStatusToLogs.
 */
export async function reviewRequestAtomic(
  client: PoolClient,
  params: { orgId: number; requestId: number; reviewerId: number; status: 'APPROVED' | 'REJECTED'; note: string | null },
): Promise<AttendanceRequestRow | null> {
  const result = await client.query(
    `UPDATE attendance_requests
        SET status = $4, reviewed_by = $3, reviewed_at = now(), review_note = $5, updated_at = now()
      WHERE id = $1 AND org_id = $2 AND status = 'PENDING'
      RETURNING ${REQUEST_COLUMNS}`,
    [params.requestId, params.orgId, params.reviewerId, params.status, params.note],
  );
  return (result.rows[0] as AttendanceRequestRow | undefined) ?? null;
}

/** Only the requester, only while PENDING (PRD.md E6 "cancel while PENDING"). */
export async function cancelRequestInOrg(orgId: number, userId: number, id: number): Promise<AttendanceRequestRow> {
  const rows = await sql.query(
    `UPDATE attendance_requests SET status = 'CANCELLED', updated_at = now()
      WHERE id = $1 AND org_id = $2 AND user_id = $3 AND status = 'PENDING'
      RETURNING ${REQUEST_COLUMNS}`,
    [id, orgId, userId],
  );
  const row = rows[0] as AttendanceRequestRow | undefined;
  if (!row) throw new NotFoundError('Request not found or not cancellable');
  return row;
}
