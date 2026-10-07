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
}

export interface NearestBranchResult {
  branch: BranchLocation;
  distanceM: number;
  isOutside: boolean;
}

/** Nearest active branch by straight-line distance, flagged if outside its own radius. */
export function nearestBranch(
  lat: number,
  lng: number,
  branches: readonly BranchLocation[],
): NearestBranchResult | null {
  let best: NearestBranchResult | null = null;
  for (const branch of branches) {
    const d = distanceM(lat, lng, branch.latitude, branch.longitude);
    if (!best || d < best.distanceM) {
      best = { branch, distanceM: d, isOutside: d > branch.radiusM };
    }
  }
  return best;
}
