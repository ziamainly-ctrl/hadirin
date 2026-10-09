import { NextResponse } from 'next/server';
import { BusinessRuleError, handleApiError } from './api-response';

/**
 * A 422 that carries structured `details` next to the message, e.g. OUTSIDE_GEOFENCE with
 * { distanceM, radiusM, branchId, branchName } so the screen can say "Anda 85 m dari Kantor
 * Pusat (batas 100 m)" in the user's own words instead of printing the server's sentence.
 * The body stays the standard envelope { error: { code, message, details? } } (TRD.md §6).
 */
export class PunchRuleError extends BusinessRuleError {
  constructor(
    code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(code, message);
    this.name = 'PunchRuleError';
  }
}

/** handleApiError, plus the `details` of a PunchRuleError. Everything else is unchanged. */
export function handlePunchError(error: unknown): NextResponse {
  if (error instanceof PunchRuleError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      { status: 422 },
    );
  }
  return handleApiError(error);
}
