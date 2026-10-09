// Pure helpers for showing a check-in location: a plain maps link (no embedded map, no external
// script) and distance wording. Unit-tested in tests/geo-link.test.ts with seed row #6 (Ayu, 212 m
// from Klinik Tebet whose radius is 80 m, ERD.md section 4).

type MaybeCoordinate = number | string | null | undefined;

function toCoordinate(value: MaybeCoordinate): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null; // Number('') is 0, a real place
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Google Maps search URL for a coordinate pair, or null when either value is missing or out of
 * range. Only finite numbers are ever put in the URL (never concatenated user text), so a bad row
 * cannot produce a link to anywhere else. NUMERIC columns arrive from the driver as strings, hence
 * the string input.
 */
export function mapsUrl(lat: MaybeCoordinate, lng: MaybeCoordinate): string | null {
  const la = toCoordinate(lat);
  const lo = toCoordinate(lng);
  if (la === null || lo === null) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return `https://www.google.com/maps/search/?api=1&query=${la},${lo}`;
}

/** How many radii away the point was, to one decimal: 212 m against an 80 m radius is 2.7. */
export function radiusMultiple(distanceM: number, radiusM: number): number {
  if (!Number.isFinite(distanceM) || !Number.isFinite(radiusM) || radiusM <= 0 || distanceM < 0) return 0;
  // Multiply before dividing so 2120 / 80 = 26.5 is exact and rounds half up to 2.7.
  return Math.round((distanceM * 10) / radiusM) / 10;
}

const KM_FORMATTER = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 212 -> "212 m", 2400 -> "2,4 km" (id-ID decimal comma). */
export function formatMeters(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  const m = Math.max(0, meters);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${KM_FORMATTER.format(m / 1000)} km`;
}

/** "1,5 km" style accuracy: GPS accuracy is shown as a plus/minus value in metres. */
export function formatAccuracy(accuracyM: number | null | undefined): string {
  if (accuracyM === null || accuracyM === undefined || !Number.isFinite(accuracyM)) return '—';
  return `±${formatMeters(accuracyM)}`;
}
