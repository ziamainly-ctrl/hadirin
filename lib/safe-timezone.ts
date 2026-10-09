// A timezone Intl accepts, else Asia/Jakarta. PATCH /api/organizations used to store any string, and
// one invalid value made every date computation throw (check-in, /m, the dashboard returned 500 for
// the whole organisation). The validator now refuses it; this keeps a bad stored row from taking
// attendance down while it is fixed. Pure, so it is unit-tested.

export const FALLBACK_TIMEZONE = 'Asia/Jakarta';

/** True when Intl accepts `timezone` as an IANA zone name ("Asia/Jakarta"). */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(timezone: string): string {
  return isValidTimezone(timezone) ? timezone : FALLBACK_TIMEZONE;
}
