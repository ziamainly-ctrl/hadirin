import { describe, it, expect } from 'vitest';
import { distanceM, formatDistance, nearestBranch } from '../lib/geo';

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

describe('nearestBranch: a branch that contains the point wins (ERD.md §3.2)', () => {
  // Two branches ~33 m and ~66 m north-east of the user: X has a 20 m radius (user is outside it),
  // Y a 500 m radius (user is inside it). Y's centre is farther, but it is the one the user is IN.
  const user = { lat: -6.26, lng: 106.81 };
  const x = { id: 1, latitude: -6.26 + 0.0003, longitude: 106.81, radiusM: 20, name: 'X' };
  const y = { id: 2, latitude: -6.26 + 0.0006, longitude: 106.81, radiusM: 500, name: 'Y' };

  it('prefers the containing branch even when another centre is nearer', () => {
    const result = nearestBranch(user.lat, user.lng, [x, y]);
    expect(result?.branch.id).toBe(2);
    expect(result?.isOutside).toBe(false);
    expect(result?.distanceM).toBeGreaterThan(distanceM(user.lat, user.lng, x.latitude, x.longitude));
  });

  it('among several containing branches, the nearest centre wins', () => {
    const z = { id: 3, latitude: -6.26 + 0.0002, longitude: 106.81, radiusM: 300, name: 'Z' };
    expect(nearestBranch(user.lat, user.lng, [y, z])?.branch.id).toBe(3);
  });

  it('when none contains the point, the globally nearest is returned and flagged outside', () => {
    const r = nearestBranch(user.lat, user.lng, [x, { ...y, radiusM: 10 }]);
    expect(r?.branch.id).toBe(1);
    expect(r?.isOutside).toBe(true);
  });

  it('keeps the extra fields of the branch it was given (the name for the screen)', () => {
    expect(nearestBranch(user.lat, user.lng, [y])?.branch.name).toBe('Y');
  });
});

describe('formatDistance', () => {
  it('shows metres under a kilometre and kilometres (id-ID decimal comma) above', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(85)).toBe('85 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1 km');
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(116236)).toBe('116 km');
  });

  it('is safe on garbage', () => {
    expect(formatDistance(Number.NaN)).toBe('-');
    expect(formatDistance(-5)).toBe('-');
  });
});
