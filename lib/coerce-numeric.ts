// Pure — no DATABASE_URL guard, no driver import — so this is unit-testable directly
// (tests/coerce-numeric.test.ts). lib/db.ts imports and applies it to every query result.

/**
 * @neondatabase/serverless returns EVERY bigint/int8 column as a string, unconditionally
 * — confirmed empirically against a real Neon database (`SELECT 42::bigint` comes back
 * as `"42"`, not `42`, on both the HTTP `neon()` driver and the WebSocket `Pool`). Every
 * BIGSERIAL id and FK in this schema (ERD.md: "no UUID") is a bigint, and every query
 * file's TypeScript interface declares these fields as `number` — so without this, the
 * declared and actual runtime types diverge everywhere. This is not theoretical: it's
 * what broke session login end-to-end during real-environment smoke testing (the `org`/
 * `sub` JWT claims came back as strings from a user row, lib/session.ts's
 * `typeof payload.org === 'number'` check rejected every token, and nobody could log in).
 *
 * Coercing every purely-numeric string in a result back to a number fixes this at the
 * one place every query function already shares (lib/db.ts), instead of touching 14
 * query files at every return site. Safe for this schema: no column is ever a bare
 * all-digit string (phones are stored "+62…", codes/slugs/hashes always have a
 * non-digit character, dates and times always have "-"/":" separators) — verified
 * against the ERD.md §4 seed and covered by tests/coerce-numeric.test.ts.
 */
export function coerceNumericStrings<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => coerceNumericStrings(v)) as T;
  // The driver returns timestamptz columns as native Date objects — Date has no own
  // enumerable properties, so recursing into it like a plain object (the first version
  // of this function did) silently rewrote every date to `{}`. Only walk plain objects.
  if (value !== null && typeof value === 'object' && !(value instanceof Date) && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = coerceNumericStrings(v);
    return out as T;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const n = Number(value);
    if (Number.isSafeInteger(n)) return n as T;
  }
  return value;
}
