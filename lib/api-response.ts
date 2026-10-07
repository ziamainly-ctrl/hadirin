import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from './auth';
import { NotFoundError } from './db';
import { CronAuthError } from './cron-auth';

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
    return apiError(400, 'VALIDATION_ERROR', 'Invalid input', fields);
  }
  if (error instanceof BusinessRuleError) {
    return apiError(422, error.code, error.message);
  }
  if (error instanceof ConflictError) {
    return apiError(409, error.code, error.message);
  }
  console.error(error);
  return apiError(500, 'INTERNAL_ERROR', 'Something went wrong');
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
