import { types, type CustomTypesConfig } from '@neondatabase/serverless';

// Per-column-type result parsing for lib/db.ts. Pure (no DATABASE_URL guard, no connection), so it
// is unit-testable directly (tests/db-types.test.ts).
//
// Why this exists. @neondatabase/serverless returns every int8/bigint column as a STRING, and every
// BIGSERIAL id and FK in this schema is a bigint, so declared (`number`) and runtime (`string`)
// types diverged on every row (TRD.md §5; it once broke login end to end, because the session JWT
// carried `org: "6"`). The first fix walked every result and turned any all-digit STRING into a
// number, whatever its column type. That corrupted real data:
//   - phone "081234567890" came back as 81234567890 (the leading 0 gone, in every API and screen),
//   - employee_code "007" came back as 7,
//   - shifts.work_days "6" (a Saturday-only shift) came back as the number 6, and /app/shifts and
//     every page that calls `.split` on it crashed for the whole organisation.
// Parsing by the column's Postgres type fixes the cause: only int8 becomes a number; varchar, text
// and numeric keep the exact text the database holds.

/** pg_type oid of int8 / bigint / BIGSERIAL (and count(*)). */
export const OID_INT8 = 20;
/** pg_type oid of int8[] (e.g. array_agg of ids). */
export const OID_INT8_ARRAY = 1016;
/** pg_type oid of DATE. */
export const OID_DATE = 1082;

/** An int8 as a number when it is a safe integer, otherwise the text untouched (no silent precision loss). */
export function parseInt8(value: string): number | string {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : value;
}

/**
 * DATE stays the calendar date text "YYYY-MM-DD". The default parser builds a JS Date at the SERVER's
 * local midnight, which serialises to the previous day on a UTC+7 machine (an owner registered on
 * the 8th was "joined 2026-10-07T17:00:00Z"). A calendar date has no time zone, so it stays text.
 */
export function parseDate(value: string): string {
  return value;
}

export const dbTypes: CustomTypesConfig = {
  getTypeParser(oid, format) {
    if (oid === OID_INT8) return parseInt8;
    if (oid === OID_INT8_ARRAY) {
      const parseArray = types.getTypeParser(oid, format);
      return (value: string) => (parseArray(value) as string[]).map(parseInt8);
    }
    if (oid === OID_DATE) return parseDate;
    return types.getTypeParser(oid, format);
  },
};
