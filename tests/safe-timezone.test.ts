import { describe, it, expect } from 'vitest';
import { FALLBACK_TIMEZONE, safeTimezone } from '../lib/safe-timezone';
import { getLocalParts } from '../lib/tz';

describe('safeTimezone', () => {
  it('keeps a valid IANA zone', () => {
    expect(safeTimezone('Asia/Jakarta')).toBe('Asia/Jakarta');
    expect(safeTimezone('Asia/Makassar')).toBe('Asia/Makassar');
    expect(safeTimezone('UTC')).toBe('UTC');
  });

  it('falls back to Asia/Jakarta for a string Intl rejects (the value that used to brick an organisation)', () => {
    expect(safeTimezone('Foo/Bar')).toBe(FALLBACK_TIMEZONE);
    expect(safeTimezone('')).toBe(FALLBACK_TIMEZONE);
    expect(safeTimezone('Jakarta')).toBe(FALLBACK_TIMEZONE);
  });

  it('the fallback zone works with the date helpers, the raw bad value throws', () => {
    expect(() => getLocalParts(new Date(), 'Foo/Bar')).toThrow();
    expect(getLocalParts(new Date('2026-10-07T20:00:00Z'), safeTimezone('Foo/Bar')).day).toBe(8);
  });
});
