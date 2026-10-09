// How trustworthy is the GPS fix, in words and bars. The thresholds follow the rest of the product:
// > 100 m is a "weak signal" (PRD US-01, GeoPermissionGate), > 1 km is refused by the server
// (ACCURACY_TOO_LOW), and the geofence radius of a branch is typically 50-200 m.

export type AccuracyLevel = 'excellent' | 'good' | 'fair' | 'weak' | 'poor';

export interface AccuracyInfo {
  level: AccuracyLevel;
  label: string;
  /** 0-4 filled bars of the meter. */
  bars: 0 | 1 | 2 | 3 | 4;
}

export function describeAccuracy(accuracyM: number | null | undefined): AccuracyInfo {
  if (accuracyM === null || accuracyM === undefined || !Number.isFinite(accuracyM) || accuracyM < 0) {
    return { level: 'poor', label: 'Belum ada sinyal', bars: 0 };
  }
  if (accuracyM <= 15) return { level: 'excellent', label: 'Sangat akurat', bars: 4 };
  if (accuracyM <= 40) return { level: 'good', label: 'Akurat', bars: 3 };
  if (accuracyM <= 100) return { level: 'fair', label: 'Cukup', bars: 2 };
  if (accuracyM <= 1000) return { level: 'weak', label: 'Lemah', bars: 1 };
  return { level: 'poor', label: 'Sangat lemah', bars: 0 };
}
