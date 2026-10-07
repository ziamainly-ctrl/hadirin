import { describe, it, expect } from 'vitest';
import { distanceM, nearestBranch } from '../lib/geo';

describe('distanceM (haversine, TRD.md §7)', () => {
  it('is 0 for the same point', () => {
    expect(distanceM(-6.2607, 106.8137, -6.2607, 106.8137)).toBe(0);
  });

  it('matches the seed row #6 (Ayu, outside Tebet by ~212 m)', () => {
    // check_in_lat/lng vs branches.id=2 (Klinik Tebet) lat/lng, ERD.md §4.
    const d = distanceM(-6.22829, 106.8541, -6.2264, 106.8538);
    expect(d).toBeGreaterThan(190);
    expect(d).toBeLessThan(230);
  });

  it('Jakarta to Bandung is roughly 115 km (sanity check against a known value)', () => {
    const d = distanceM(-6.2088, 106.8456, -6.9175, 107.6191);
    expect(d).toBeGreaterThan(100_000);
    expect(d).toBeLessThan(135_000);
  });
});

describe('nearestBranch', () => {
  const branches = [
    { id: 1, latitude: -6.2607, longitude: 106.8137, radiusM: 100 },
    { id: 2, latitude: -6.2264, longitude: 106.8538, radiusM: 80 },
  ];

  it('picks the closer branch and flags outside when beyond its own radius', () => {
    const result = nearestBranch(-6.2611, 106.814, branches);
    expect(result?.branch.id).toBe(1);
    expect(result?.isOutside).toBe(false);
  });

  it('flags isOutside true when even the nearest branch radius is exceeded', () => {
    const result = nearestBranch(-6.2283, 106.854, branches); // ~212m from branch 2 (radius 80)
    expect(result?.branch.id).toBe(2);
    expect(result?.isOutside).toBe(true);
  });

  it('returns null for an empty branch list', () => {
    expect(nearestBranch(-6.2, 106.8, [])).toBeNull();
  });
});
