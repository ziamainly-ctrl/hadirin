import { describe, it, expect } from 'vitest';
import { distanceM } from '../lib/geo';
import { formatAccuracy, formatMeters, mapsUrl, radiusMultiple } from '../lib/geo-link';

describe('mapsUrl', () => {
  it('builds a maps search link from numbers', () => {
    expect(mapsUrl(-6.22829, 106.8541)).toBe('https://www.google.com/maps/search/?api=1&query=-6.22829,106.8541');
  });
  it('accepts the NUMERIC strings the driver returns', () => {
    expect(mapsUrl('-6.228290', '106.854100')).toBe('https://www.google.com/maps/search/?api=1&query=-6.22829,106.8541');
  });
  it('is null when a coordinate is missing, empty or not finite', () => {
    expect(mapsUrl(null, 106.8)).toBeNull();
    expect(mapsUrl(-6.2, undefined)).toBeNull();
    expect(mapsUrl('', '')).toBeNull();
    expect(mapsUrl('abc', 106.8)).toBeNull();
    expect(mapsUrl(Number.NaN, 106.8)).toBeNull();
    expect(mapsUrl(Number.POSITIVE_INFINITY, 106.8)).toBeNull();
  });
  it('is null outside the valid range, and valid at the edges', () => {
    expect(mapsUrl(90.0001, 0)).toBeNull();
    expect(mapsUrl(0, 180.5)).toBeNull();
    expect(mapsUrl(-90, -180)).not.toBeNull();
    expect(mapsUrl(90, 180)).not.toBeNull();
  });
  it('never carries text other than numbers into the URL', () => {
    expect(mapsUrl('1e1', '2')).toBe('https://www.google.com/maps/search/?api=1&query=10,2');
    expect(mapsUrl('1&q=evil', '2')).toBeNull();
  });
});

describe('radiusMultiple', () => {
  it('seed row #6: 212 m against an 80 m radius is 2.7x', () => {
    expect(radiusMultiple(212, 80)).toBe(2.7);
  });
  it('matches the haversine distance of the seed row', () => {
    const d = distanceM(-6.22829, 106.8541, -6.2264, 106.8538);
    expect(radiusMultiple(d, 80)).toBeGreaterThan(2.3);
    expect(radiusMultiple(d, 80)).toBeLessThan(3);
  });
  it('is 1 on the edge and below 1 inside', () => {
    expect(radiusMultiple(100, 100)).toBe(1);
    expect(radiusMultiple(50, 100)).toBe(0.5);
  });
  it('is 0 for unusable input instead of NaN or Infinity', () => {
    expect(radiusMultiple(10, 0)).toBe(0);
    expect(radiusMultiple(10, -5)).toBe(0);
    expect(radiusMultiple(Number.NaN, 80)).toBe(0);
    expect(radiusMultiple(-1, 80)).toBe(0);
  });
});

describe('formatMeters', () => {
  it('uses metres below one kilometre', () => {
    expect(formatMeters(0)).toBe('0 m');
    expect(formatMeters(212)).toBe('212 m');
    expect(formatMeters(999.4)).toBe('999 m');
  });
  it('uses kilometres with an id-ID decimal comma from 1000 m', () => {
    expect(formatMeters(1000)).toBe('1,0 km');
    expect(formatMeters(2400)).toBe('2,4 km');
    expect(formatMeters(116236)).toBe('116,2 km');
  });
  it('is a dash for a non-finite value', () => {
    expect(formatMeters(Number.NaN)).toBe('—');
  });
});

describe('formatAccuracy', () => {
  it('prefixes plus/minus and is a dash without a value', () => {
    expect(formatAccuracy(24)).toBe('±24 m');
    expect(formatAccuracy(null)).toBe('—');
    expect(formatAccuracy(undefined)).toBe('—');
  });
});
