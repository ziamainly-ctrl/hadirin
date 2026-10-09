import { describe, it, expect } from 'vitest';
import {
  attendanceRateSeries,
  hourHistogram,
  statusMix,
  summarizeTrend,
  weekdaySummary,
  formatHour,
} from '../lib/insights/statistics';

const day = (date: string, present: number, late: number, absent: number, away = 0) => ({ date, present, late, absent, away });

describe('lib/insights/statistics', () => {
  it('attendanceRateSeries skips days with nothing expected and flags today as partial', () => {
    const series = attendanceRateSeries(
      [day('2026-10-06', 5, 1, 0), day('2026-10-04', 0, 0, 0, 2), day('2026-10-05', 3, 1, 1), day('2026-10-07', 2, 0, 0)],
      '2026-10-07',
    );
    expect(series.map((p) => p.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(series[0]).toMatchObject({ rate: 80, attended: 4, obligated: 5, partial: false });
    expect(series[1]!.rate).toBe(100);
    expect(series[2]).toMatchObject({ partial: true, label: '7 Okt' });
  });

  it('rate has one decimal and never exceeds 100', () => {
    const [p] = attendanceRateSeries([day('2026-10-05', 1, 1, 1)], '2026-10-07');
    expect(p!.rate).toBe(66.7);
  });

  it('statusMix sums every status', () => {
    expect(statusMix([day('2026-10-05', 3, 1, 1, 1), day('2026-10-06', 5, 0, 0, 0)])).toEqual({
      present: 8,
      late: 1,
      absent: 1,
      away: 1,
      total: 11,
    });
  });

  it('summarizeTrend: overall rate, late share, best and worst day; empty input is all null', () => {
    const days = [day('2026-10-05', 3, 1, 1), day('2026-10-06', 5, 0, 0)];
    const series = attendanceRateSeries(days, '2026-10-07');
    const summary = summarizeTrend(series, statusMix(days));
    expect(summary.overallRate).toBe(90); // 9 of 10
    expect(summary.lateShare).toBe(11.1); // 1 of 9
    expect(summary.best?.date).toBe('2026-10-06');
    expect(summary.worst?.date).toBe('2026-10-05');
    expect(summarizeTrend([], statusMix([]))).toEqual({ overallRate: null, lateShare: null, best: null, worst: null });
  });

  it('hourHistogram trims to the span with data (+1 hour each side) and finds the peak', () => {
    const h = hourHistogram([
      { hour: 7, count: 4 },
      { hour: 8, count: 11 },
      { hour: 9, count: 2 },
    ]);
    expect(h.buckets.map((b) => b.hour)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(h.peakHour).toBe(8);
    expect(h.peakCount).toBe(11);
    expect(h.total).toBe(17);
  });

  it('hourHistogram keeps at least six hours even when the data is a single hour at the end of the day', () => {
    const h = hourHistogram([{ hour: 23, count: 1 }]);
    expect(h.buckets[0]!.hour).toBe(18);
    expect(h.buckets.at(-1)!.hour).toBe(23);
    expect(h.buckets).toHaveLength(6);
  });

  it('hourHistogram ignores out-of-range hours and is empty without data', () => {
    expect(hourHistogram([])).toEqual({ buckets: [], total: 0, peakHour: null, peakCount: 0 });
    expect(hourHistogram([{ hour: 30, count: 5 }, { hour: -1, count: 2 }]).total).toBe(0);
  });

  it('weekdaySummary always returns Mon..Sun and picks the busiest by average per day', () => {
    const s = weekdaySummary([
      { dow: 1, attended: 40, late: 4, absent: 2, days: 4 },
      { dow: 3, attended: 50, late: 5, absent: 0, days: 4 },
      { dow: 5, attended: 30, late: 0, absent: 0, days: 4 },
    ]);
    expect(s.stats.map((x) => x.label)).toEqual(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']);
    expect(s.busiest).toMatchObject({ dow: 3, avgAttended: 12.5 });
    expect(s.stats[1]).toMatchObject({ days: 0, avgAttended: 0, lateRate: null });
    expect(s.stats[0]!.lateRate).toBe(10);
  });

  it('weekdaySummary: ties go to the earlier weekday, and no check-ins means no busiest day', () => {
    const tie = weekdaySummary([
      { dow: 2, attended: 10, late: 0, absent: 0, days: 2 },
      { dow: 4, attended: 10, late: 0, absent: 0, days: 2 },
    ]);
    expect(tie.busiest?.dow).toBe(2);
    expect(weekdaySummary([]).busiest).toBeNull();
  });

  it('formatHour pads to the id-ID clock style', () => {
    expect(formatHour(7)).toBe('07.00');
    expect(formatHour(13)).toBe('13.00');
  });
});

import { comparePeriods, niceMax } from '../lib/insights/statistics';

describe('niceMax', () => {
  it('rounds up to 1, 2, 5 x 10^k', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(11)).toBe(20);
    expect(niceMax(37)).toBe(50);
    expect(niceMax(51)).toBe(100);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(1234)).toBe(2000);
  });
});

describe('comparePeriods', () => {
  const summary = (overallRate: number | null, lateShare: number | null) => ({ overallRate, lateShare, best: null, worst: null });

  it('is the difference in percentage points, one decimal', () => {
    expect(comparePeriods(summary(95.2, 18), summary(92.1, 20.5))).toEqual({ rateDelta: 3.1, lateShareDelta: -2.5 });
    expect(comparePeriods(summary(90, 10), summary(90, 10))).toEqual({ rateDelta: 0, lateShareDelta: 0 });
  });

  it('is null when either period has no data', () => {
    expect(comparePeriods(summary(95, 10), summary(null, null))).toEqual({ rateDelta: null, lateShareDelta: null });
    expect(comparePeriods(summary(null, null), summary(95, 10))).toEqual({ rateDelta: null, lateShareDelta: null });
  });
});
