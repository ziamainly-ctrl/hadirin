// Same haversine formula as Digispace's `calculateDistance()` (TRD.md §7), re-implemented
// from scratch — AGENTS.md forbids copying code from growt/digispace-ydsf-v2.

const EARTH_RADIUS_M = 6371000;

export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)));
}

export interface BranchLocation {
  id: number;
  latitude: number;
  longitude: number;
  radiusM: number;
  /** Optional so the bare geofence rows keep working; callers that show a branch pass it. */
  name?: string;
}

export interface NearestBranchResult<T extends BranchLocation = BranchLocation> {
  branch: T;
  distanceM: number;
  isOutside: boolean;
}

/**
 * The branch a punch belongs to (ERD.md §3.2: "a tracked user may check in at any active
 * branch of the org; the nearest one within radius wins").
 *
 * 1. Branches whose radius CONTAINS the point: the nearest of those wins, `isOutside = false`.
 *    A user standing inside a large-radius branch is never rejected because a smaller branch's
 *    centre happens to be closer.
 * 2. Otherwise the globally nearest branch, flagged `isOutside = true` (the caller decides
 *    whether STRICT mode refuses it or FLAG mode records the flag).
 */
export function nearestBranch<T extends BranchLocation>(
  lat: number,
  lng: number,
  branches: readonly T[],
): NearestBranchResult<T> | null {
  let nearestInside: NearestBranchResult<T> | null = null;
  let nearestAny: NearestBranchResult<T> | null = null;
  for (const branch of branches) {
    const d = distanceM(lat, lng, branch.latitude, branch.longitude);
    const inside = d <= branch.radiusM;
    if (!nearestAny || d < nearestAny.distanceM) {
      nearestAny = { branch, distanceM: d, isOutside: !inside };
    }
    if (inside && (!nearestInside || d < nearestInside.distanceM)) {
      nearestInside = { branch, distanceM: d, isOutside: false };
    }
  }
  return nearestInside ?? nearestAny;
}

/** 85 -> "85 m", 1234 -> "1,2 km" (id-ID decimal comma), 12000 -> "12 km". */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '-';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const text = km >= 10 ? String(Math.round(km)) : km.toFixed(1).replace('.', ',');
  return `${text.replace(/,0$/, '')} km`;
}
