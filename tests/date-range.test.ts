import { describe, it, expect } from 'vitest';
import { daysInRange, detectPreset, isCalendarDate, parsePeriod, presetRange } from '../lib/date-range';

// "Today" is Wednesday 2026-10-07, the seed date (ERD.md section 4).
const TODAY = '2026-10-07';
const monthStart = (today: string) => `${today.slice(0, 7)}-01`;
const OPTS = { today: TODAY, maxDays: 92, defaultFrom: monthStart };

describe('isCalendarDate', () => {
  it('accepts real dates, including a leap day', () => {
    expect(isCalendarDate('2026-10-07')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
  });
  it('rejects shape errors and impossible dates', () => {
    expect(isCalendarDate('2026-02-31')).toBe(false);
    expect(isCalendarDate('2027-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('07-10-2026')).toBe(false);
    expect(isCalendarDate('')).toBe(false);
    expect(isCalendarDate(undefined)).toBe(false);
  });
});

describe('daysInRange', () => {
  it('counts both ends', () => {
    expect(daysInRange('2026-10-07', '2026-10-07')).toBe(1);
    expect(daysInRange('2026-10-01', '2026-10-07')).toBe(7);
  });
  it('crosses a month boundary', () => {
    expect(daysInRange('2026-10-31', '2026-11-01')).toBe(2);
  });
  it('knows 2028 has a leap day', () => {
    expect(daysInRange('2028-02-28', '2028-03-01')).toBe(3);
    expect(daysInRange('2027-02-28', '2027-03-01')).toBe(2);
  });
  it('is 0 for a reversed span', () => {
    expect(daysInRange('2026-10-08', '2026-10-07')).toBe(0);
  });
});

describe('presetRange', () => {
  it('today / 7d / 30d end today', () => {
    expect(presetRange('today', TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(presetRange('7d', TODAY)).toEqual({ from: '2026-10-01', to: TODAY });
    expect(presetRange('30d', TODAY)).toEqual({ from: '2026-09-08', to: TODAY });
  });
  it('month runs from the 1st to today', () => {
    expect(presetRange('month', TODAY)).toEqual({ from: '2026-10-01', to: TODAY });
  });
  it('lastmonth is the whole previous month, across a year boundary too', () => {
    expect(presetRange('lastmonth', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('lastmonth', '2027-01-15')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
  it('lastmonth handles a leap February', () => {
    expect(presetRange('lastmonth', '2028-03-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('detectPreset', () => {
  it('names the preset a range equals', () => {
    expect(detectPreset({ from: TODAY, to: TODAY }, TODAY)).toBe('today');
    expect(detectPreset({ from: '2026-10-01', to: TODAY }, TODAY)).toBe('7d');
    expect(detectPreset({ from: '2026-09-08', to: TODAY }, TODAY)).toBe('30d');
    expect(detectPreset({ from: '2026-09-01', to: '2026-09-30' }, TODAY)).toBe('lastmonth');
  });
  it('is custom for anything else', () => {
    expect(detectPreset({ from: '2026-10-02', to: TODAY }, TODAY)).toBe('custom');
  });
  it('prefers "today" on the 1st, where month and today are the same range', () => {
    expect(detectPreset({ from: '2026-10-01', to: '2026-10-01' }, '2026-10-01')).toBe('today');
  });
});

describe('parsePeriod', () => {
  it('uses the defaults when nothing is given', () => {
    expect(parsePeriod({}, OPTS)).toEqual({ from: '2026-10-01', to: TODAY, preset: '7d', clamped: false });
  });
  it('ignores invalid values instead of failing', () => {
    const p = parsePeriod({ dateFrom: 'abc', dateTo: '2026-02-31' }, OPTS);
    expect(p.from).toBe('2026-10-01');
    expect(p.to).toBe(TODAY);
  });
  it('swaps a reversed pair', () => {
    const p = parsePeriod({ dateFrom: '2026-10-05', dateTo: '2026-10-02' }, OPTS);
    expect(p).toMatchObject({ from: '2026-10-02', to: '2026-10-05', preset: 'custom' });
  });
  it('never lets the end go past today', () => {
    const p = parsePeriod({ dateFrom: '2026-10-05', dateTo: '2026-12-31' }, OPTS);
    expect(p.to).toBe(TODAY);
    expect(p.from).toBe('2026-10-05');
  });
  it('a start in the future collapses to today', () => {
    const p = parsePeriod({ dateFrom: '2027-01-01' }, OPTS);
    expect(p).toMatchObject({ from: TODAY, to: TODAY, preset: 'today' });
  });
  it('a lone past dateTo before the default start follows it as one day', () => {
    const p = parsePeriod({ dateTo: '2026-09-20' }, OPTS);
    expect(p).toMatchObject({ from: '2026-09-20', to: '2026-09-20' });
  });
  it('clamps at maxDays keeping the end, and flags it', () => {
    const p = parsePeriod({ dateFrom: '2025-01-01', dateTo: TODAY }, OPTS);
    expect(p.clamped).toBe(true);
    expect(p.to).toBe(TODAY);
    expect(daysInRange(p.from, p.to)).toBe(92);
    expect(p.from).toBe('2026-07-08');
  });
  it('does not flag a span of exactly maxDays', () => {
    const p = parsePeriod({ dateFrom: '2026-07-08', dateTo: TODAY }, OPTS);
    expect(p.clamped).toBe(false);
    expect(p.from).toBe('2026-07-08');
  });
  it('clamps tighter for the selfie gallery (7 days)', () => {
    const p = parsePeriod(
      { dateFrom: '2026-09-01', dateTo: '2026-09-30' },
      { today: TODAY, maxDays: 7, defaultFrom: (t) => t },
    );
    expect(p).toMatchObject({ from: '2026-09-24', to: '2026-09-30', clamped: true });
  });
  it('works across a month boundary', () => {
    const p = parsePeriod({ dateFrom: '2026-10-31', dateTo: '2026-11-01' }, { ...OPTS, today: '2026-11-05' });
    expect(p).toMatchObject({ from: '2026-10-31', to: '2026-11-01', clamped: false });
  });
  it('accepts a leap day', () => {
    const p = parsePeriod({ dateFrom: '2028-02-29', dateTo: '2028-02-29' }, { ...OPTS, today: '2028-03-02' });
    expect(p).toMatchObject({ from: '2028-02-29', to: '2028-02-29' });
  });
});
