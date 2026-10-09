import { describe, it, expect } from 'vitest';
import { formatDayShort, formatDaysAgo, formatPeriod, formatShortDate, formatWorkDate, percent } from '../lib/insights-format';

describe('formatPeriod', () => {
  it('a single day', () => {
    expect(formatPeriod('2026-10-07', '2026-10-07')).toBe(formatShortDate('2026-10-07'));
    expect(formatPeriod('2026-10-07', '2026-10-07')).toMatch(/7 Okt 2026/);
  });
  it('same month collapses the month and year', () => {
    expect(formatPeriod('2026-10-01', '2026-10-07')).toMatch(/^1–7 Okt 2026$/);
  });
  it('across months keeps the year once', () => {
    expect(formatPeriod('2026-09-28', '2026-10-07')).toMatch(/^28 Sep – 7 Okt 2026$/);
  });
  it('across years spells both years', () => {
    expect(formatPeriod('2026-12-30', '2027-01-02')).toMatch(/^30 Des 2026 – 2 Jan 2027$/);
  });
});

describe('formatWorkDate', () => {
  it('does not shift the day under any server timezone (UTC pinned)', () => {
    // 2026-10-07 is a Wednesday.
    expect(formatWorkDate('2026-10-07')).toMatch(/Rab/);
    expect(formatWorkDate('2026-10-07')).toMatch(/7 Okt 2026/);
  });
});

describe('formatDayShort', () => {
  it('weekday, day and month without the year', () => {
    expect(formatDayShort('2026-10-07')).toMatch(/^Rab, 7 Okt$/);
  });
});

describe('formatDaysAgo', () => {
  it('names today, yesterday and older days', () => {
    expect(formatDaysAgo('2026-10-07', '2026-10-07')).toBe('hari ini');
    expect(formatDaysAgo('2026-10-06', '2026-10-07')).toBe('kemarin');
    expect(formatDaysAgo('2026-10-04', '2026-10-07')).toBe('3 hari lalu');
    expect(formatDaysAgo('2026-09-30', '2026-10-07')).toBe('7 hari lalu');
  });
});

describe('percent', () => {
  it('rounds and guards against a zero denominator', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(5, 0)).toBe(0);
  });
});
