import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from './auth';
import { NotFoundError } from './db';
import { CronAuthError } from './cron-auth';
// Side effect: swaps Zod's default (English) issue messages for short Indonesian ones, so the
// per-field text in a VALIDATION_ERROR response is already fit to show next to a form field.
import './validators/locale-id';

// Every route handler returns one of these two shapes (TRD.md §6).

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function apiCreated<T>(data: T): NextResponse {
  return apiOk(data, 201);
}

export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

// Postgres unique violation (SQLSTATE 23505) -> the field the person can fix. Keys are the index names in
// drizzle/*.sql; an index not listed here still answers 409, just without a field.
const UNIQUE_VIOLATION = '23505';
const DUPLICATE_FIELDS: Record<string, { field: string; message: string }> = {
  uq_branches_org_name: { field: 'name', message: 'Nama cabang sudah dipakai.' },
  uq_shifts_org_name: { field: 'name', message: 'Nama shift sudah dipakai.' },
  uq_users_email: { field: 'email', message: 'Email ini sudah terdaftar.' },
  uq_users_phone: { field: 'phone', message: 'Nomor telepon ini sudah terdaftar.' },
  uq_users_org_code: { field: 'employeeCode', message: 'Kode karyawan sudah dipakai.' },
  uq_holidays_scope_date: { field: 'holidayDate', message: 'Tanggal ini sudah ada di daftar libur.' },
};

function uniqueViolation(error: unknown): { constraint: string | undefined } | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  if (code !== UNIQUE_VIOLATION) return null;
  return { constraint: typeof constraint === 'string' ? constraint : undefined };
}

const AUTH_ERROR_STATUS: Record<AuthError['code'], number> = {
  NO_SESSION: 401,
  FORBIDDEN: 403,
  INACTIVE: 403,
  SUSPENDED: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
};

/** Maps a thrown error to the right HTTP response. Route handlers wrap their body in try/catch and call this in the catch. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return apiError(AUTH_ERROR_STATUS[error.code], error.code, error.message);
  }
  if (error instanceof CronAuthError) {
    return apiError(401, 'UNAUTHORIZED', error.message);
  }
  if (error instanceof NotFoundError) {
    return apiError(404, 'NOT_FOUND', error.message);
  }
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_root';
      if (!fields[key]) fields[key] = issue.message;
    }
    return apiError(400, 'VALIDATION_ERROR', 'Data tidak valid. Periksa isian yang ditandai.', fields);
  }
  if (error instanceof SyntaxError) {
    // request.json() on a body that is not JSON: the caller's mistake, not a server fault.
    return apiError(400, 'VALIDATION_ERROR', 'Isi permintaan bukan JSON yang valid.');
  }
  if (error instanceof BusinessRuleError) {
    return apiError(422, error.code, error.message);
  }
  if (error instanceof ConflictError) {
    return apiError(409, error.code, error.message);
  }
  const duplicate = uniqueViolation(error);
  if (duplicate) {
    const hit = duplicate.constraint ? DUPLICATE_FIELDS[duplicate.constraint] : undefined;
    return hit
      ? apiError(409, 'DUPLICATE', hit.message, { [hit.field]: hit.message })
      : apiError(409, 'DUPLICATE', 'Data ini sudah ada. Periksa isian Anda.');
  }
  console.error(error);
  return apiError(500, 'INTERNAL_ERROR', 'Terjadi kesalahan di server. Coba lagi.');
}

/** 422 — a well-formed request that violates a business rule (e.g. outside geofence). */
export class BusinessRuleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

/** 409 — state conflict (already checked out, request already reviewed, …). */
export class ConflictError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}
