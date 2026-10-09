import { describe, expect, it } from 'vitest';
import { formatRelative } from '@/lib/relative-time';

const NOW = Date.UTC(2026, 9, 7, 5, 0, 0); // 2026-10-07 12:00 WIB
const ago = (ms: number) => NOW - ms;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('formatRelative', () => {
  it('says "baru saja" under 45 seconds', () => {
    expect(formatRelative(NOW, ago(0))).toBe('baru saja');
    expect(formatRelative(NOW, ago(44 * SECOND))).toBe('baru saja');
  });

  it('treats an instant slightly in the future (clock skew) as "baru saja"', () => {
    expect(formatRelative(NOW, NOW + 20 * SECOND)).toBe('baru saja');
  });

  it('switches to minutes at 45 seconds and never shows "0 mnt"', () => {
    expect(formatRelative(NOW, ago(45 * SECOND))).toBe('1 mnt lalu');
    expect(formatRelative(NOW, ago(2 * MINUTE + 30 * SECOND))).toBe('2 mnt lalu');
    expect(formatRelative(NOW, ago(59 * MINUTE + 59 * SECOND))).toBe('59 mnt lalu');
  });

  it('switches to hours at 60 minutes', () => {
    expect(formatRelative(NOW, ago(60 * MINUTE))).toBe('1 jam lalu');
    expect(formatRelative(NOW, ago(5 * HOUR + 40 * MINUTE))).toBe('5 jam lalu');
    expect(formatRelative(NOW, ago(23 * HOUR + 59 * MINUTE))).toBe('23 jam lalu');
  });

  it('says "kemarin" between 24 and 48 hours', () => {
    expect(formatRelative(NOW, ago(24 * HOUR))).toBe('kemarin');
    expect(formatRelative(NOW, ago(47 * HOUR))).toBe('kemarin');
  });

  it('falls back to a short id-ID date in the given time zone after 48 hours', () => {
    expect(formatRelative(NOW, Date.UTC(2026, 9, 4, 5, 0, 0))).toMatch(/^4 Okt/);
    // 2026-10-04 20:00 UTC is already 5 Okt in Jakarta (UTC+7), still 4 Okt in UTC.
    const at = Date.UTC(2026, 9, 4, 20, 0, 0);
    expect(formatRelative(NOW, at, 'Asia/Jakarta')).toMatch(/^5 Okt/);
    expect(formatRelative(NOW, at, 'UTC')).toMatch(/^4 Okt/);
  });
});
