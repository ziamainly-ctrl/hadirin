// Thresholds behind the review pages /app/terlambat and /app/luar-area. Plain constants (no I/O, no
// database import) so both the SQL in lib/queries/insights.ts and the UI use one definition and a
// unit test can pin them to the rules in lib/attendance-rules.ts.

/** Late categories (ERD.md section 3.2): A up to 15 min, B up to 30, C above. Mirrors lateCategory(). */
export const LATE_CATEGORY_A_MAX_MIN = 15;
export const LATE_CATEGORY_B_MAX_MIN = 30;

/** GPS accuracy worse than this is a weak signal (components/shared/GeoPermissionGate.tsx, PRD US-01). */
export const WEAK_ACCURACY_M = 100;

/** "Near the edge": the check-in distance reached this share of the branch radius. */
export const NEAR_EDGE_RATIO = 0.8;
