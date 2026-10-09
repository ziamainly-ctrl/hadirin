import { describe, it, expect } from 'vitest';
import {
  buildMonthGrid,
  daysInMonth,
  formatLongDate,
  formatMonthLabel,
  formatShortDate,
  isRealDate,
  isoWeekday,
  listMonthDates,
  monthEnd,
  parseMonthParam,
  shiftMonth,
} from '../lib/insights/calendar-grid';

describe('lib/insights/calendar-grid', () => {
  it('isoWeekday: seed Wednesday 2026-10-07 is 3, Sunday 2026-10-11 is 7', () => {
    expect(isoWeekday('2026-10-07')).toBe(3);
    expect(isoWeekday('2026-10-11')).toBe(7);
    expect(isoWeekday('2026-10-05')).toBe(1);
  });

  it('daysInMonth handles February in a leap year', () => {
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2026-10')).toBe(31);
    expect(monthEnd('2026-11')).toBe('2026-11-30');
  });

  it('isRealDate rejects 2026-02-31 and malformed text', () => {
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2026-02-31')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(isRealDate('2026-1-1')).toBe(false);
  });

  it('shiftMonth crosses the year boundary both ways', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', -24)).toBe('2024-10');
  });

  it('parseMonthParam: falls back on junk, clamps to 24 months back and 1 forward', () => {
    expect(parseMonthParam(undefined, '2026-10')).toBe('2026-10');
    expect(parseMonthParam('abc', '2026-10')).toBe('2026-10');
    expect(parseMonthParam('2026-13', '2026-10')).toBe('2026-10');
    expect(parseMonthParam('2026-07', '2026-10')).toBe('2026-07');
    expect(parseMonthParam('2020-01', '2026-10')).toBe('2024-10');
    expect(parseMonthParam('2027-05', '2026-10')).toBe('2026-11');
  });

  it('formats labels in Indonesian', () => {
    expect(formatMonthLabel('2026-10')).toBe('Oktober 2026');
    expect(formatShortDate('2026-08-17')).toBe('17 Agu');
    expect(formatLongDate('2026-10-07')).toBe('Rabu, 7 Oktober 2026');
  });

  it('buildMonthGrid: October 2026 starts on a Thursday, Monday first, 5 full weeks', () => {
    const weeks = buildMonthGrid('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // 1 Oct 2026 is a Thursday: Mon-Wed of week 1 are September.
    expect(weeks[0]!.map((d) => d.date)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(weeks[0]!.map((d) => d.inMonth)).toEqual([false, false, false, true, true, true, true]);
    expect(weeks[0]![0]!.weekday).toBe(1);
    expect(weeks[4]![6]!.date).toBe('2026-11-01');
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31);
  });

  it('buildMonthGrid: a month that starts on Monday and has 28 days is exactly 4 rows', () => {
    // February 2027 starts on a Monday and has 28 days.
    const weeks = buildMonthGrid('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((d) => d.inMonth)).toBe(true);
  });

  it('buildMonthGrid: a 31-day month starting on Sunday needs 6 rows', () => {
    // March 2026 starts on a Sunday.
    expect(buildMonthGrid('2026-03')).toHaveLength(6);
  });

  it('listMonthDates lists every day once', () => {
    const dates = listMonthDates('2026-02');
    expect(dates).toHaveLength(28);
    expect(dates[0]).toBe('2026-02-01');
    expect(dates[27]).toBe('2026-02-28');
  });
});
