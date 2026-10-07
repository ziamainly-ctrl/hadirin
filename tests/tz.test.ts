import { describe, it, expect } from 'vitest';
import { addDaysToDateString, formatDate, parseDate, zonedTimeToInstant, getLocalParts } from '../lib/tz';

describe('lib/tz (Intl-only timezone helpers — no date library in TRD.md §3)', () => {
  it('zonedTimeToInstant: 2026-10-06 07:00 Asia/Jakarta (UTC+7, no DST) is 00:00 UTC', () => {
    const instant = zonedTimeToInstant(2026, 10, 6, 7, 0, 0, 'Asia/Jakarta');
    expect(instant.toISOString()).toBe('2026-10-06T00:00:00.000Z');
  });

  it('getLocalParts round-trips through zonedTimeToInstant', () => {
    const instant = zonedTimeToInstant(2026, 10, 6, 23, 30, 0, 'Asia/Jakarta');
    const parts = getLocalParts(instant, 'Asia/Jakarta');
    expect(parts).toEqual({ year: 2026, month: 10, day: 6, hour: 23, minute: 30, second: 0 });
  });

  it('addDaysToDateString handles month and year rollover', () => {
    expect(addDaysToDateString('2026-10-06', -1)).toBe('2026-10-05');
    expect(addDaysToDateString('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('formatDate / parseDate are inverses', () => {
    expect(formatDate(2026, 1, 9)).toBe('2026-01-09');
    expect(parseDate('2026-01-09')).toEqual({ year: 2026, month: 1, day: 9 });
  });
});
