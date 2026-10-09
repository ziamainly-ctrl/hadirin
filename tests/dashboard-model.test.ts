import { describe, it, expect } from 'vitest';
import {
  averageRate,
  branchBreakdown,
  buildAttentionRows,
  buildDaySeries,
  buildHeatmap,
  buildHourSeries,
  buildKpis,
  buildSetupSteps,
  daysBetween,
  formatClock,
  formatMinutes,
  formatPercent,
  formatSigned,
  heatLevel,
  outsidePeople,
  ratePercent,
  recentPunches,
  referenceLabel,
  summarizeToday,
  todayHourCounts,
  trendPoints,
  weekStartOf,
} from '@/app/app/dashboard/model';
import type { AttentionData, RosterRow } from '@/app/app/dashboard/model';
import type { DailyOverviewRow, SameTimeSnapshot } from '@/lib/queries/dashboard-insights';

// The seed Wednesday of ERD §4 (2026-10-07): the week of 2026-10-05 is the "current" week below.
const TODAY = '2026-10-07';

function row(partial: Partial<RosterRow> & Pick<RosterRow, 'userId' | 'status'>): RosterRow {
  return {
    name: `Karyawan ${partial.userId}`,
    branchId: 1,
    branchName: 'Klinik Kemang',
    checkInAt: null,
    checkOutAt: null,
    checkInIsOutside: false,
    checkOutIsOutside: false,
    ...partial,
  };
}

const roster: RosterRow[] = [
  row({ userId: 1, status: 'PRESENT', checkInAt: '2026-10-07T00:55:00Z', checkOutAt: '2026-10-07T10:05:00Z' }),
  row({ userId: 2, status: 'PRESENT', checkInAt: '2026-10-07T01:00:00Z' }),
  row({ userId: 3, status: 'LATE', checkInAt: '2026-10-07T01:40:00Z', checkInIsOutside: true }),
  row({ userId: 4, status: 'NOT_YET_IN', branchId: 2, branchName: 'Klinik Tebet' }),
  row({ userId: 5, status: 'ABSENT', branchId: 2, branchName: 'Klinik Tebet' }),
  row({ userId: 6, status: 'LEAVE', branchId: null, branchName: null }),
  row({ userId: 7, status: 'HOLIDAY', branchId: 2, branchName: 'Klinik Tebet' }),
];

describe('ratePercent', () => {
  it('rounds to one decimal and is null without a whole', () => {
    expect(ratePercent(2, 3)).toBe(66.7);
    expect(ratePercent(5, 5)).toBe(100);
    expect(ratePercent(0, 4)).toBe(0);
    expect(ratePercent(0, 0)).toBeNull();
  });
});

describe('summarizeToday', () => {
  it('counts each state once and keeps leave out of the rate', () => {
    const s = summarizeToday(roster);
    expect(s).toMatchObject({ total: 7, onTime: 2, late: 1, hadir: 3, belum: 2, away: 2, outside: 1, openNow: 2, expected: 5 });
    expect(s.rate).toBe(60);
  });

  it('is calm on an empty board', () => {
    expect(summarizeToday([])).toMatchObject({ total: 0, hadir: 0, expected: 0, rate: null });
  });

  it('flags a check-out outside the geofence too, but only once per person', () => {
    const s = summarizeToday([row({ userId: 1, status: 'PRESENT', checkInAt: 'x', checkInIsOutside: true, checkOutIsOutside: true })]);
    expect(s.outside).toBe(1);
  });
});

describe('branchBreakdown', () => {
  it('groups by home branch, biggest first, with "Tanpa cabang" for none', () => {
    const bars = branchBreakdown(roster);
    expect(bars.map((b) => [b.name, b.total])).toEqual([
      ['Klinik Kemang', 3],
      ['Klinik Tebet', 3],
      ['Tanpa cabang', 1],
    ]);
    const tebet = bars.find((b) => b.name === 'Klinik Tebet')!;
    expect(tebet).toMatchObject({ belum: 2, away: 1, onTime: 0, late: 0 });
    expect(bars.find((b) => b.id === 'none')!.away).toBe(1);
  });
});

describe('recentPunches', () => {
  it('lists check-ins and check-outs newest first and honours the limit', () => {
    const feed = recentPunches(roster, 3);
    expect(feed.map((p) => p.id)).toEqual(['1-out', '3-in', '2-in']);
    expect(feed[1]).toMatchObject({ kind: 'IN', late: true, outside: true });
    expect(feed[0]).toMatchObject({ kind: 'OUT', late: false });
  });

  it('is empty when nobody punched', () => {
    expect(recentPunches([row({ userId: 9, status: 'NOT_YET_IN' })], 5)).toEqual([]);
  });
});

describe('todayHourCounts', () => {
  it('buckets check-ins by the organisation clock, not UTC', () => {
    // 00:55Z and 01:00Z are 07:55 and 08:00 in Jakarta; 01:40Z is 08:40.
    const counts = todayHourCounts(roster, 'Asia/Jakarta');
    expect(counts.get(7)).toBe(1);
    expect(counts.get(8)).toBe(2);
    expect(counts.get(0)).toBeUndefined();
  });
});

describe('outsidePeople', () => {
  it('names who was outside, latest check-in first', () => {
    const rows = [
      row({ userId: 1, name: 'A', status: 'PRESENT', checkInAt: '2026-10-07T01:00:00Z', checkInIsOutside: true }),
      row({ userId: 2, name: 'B', status: 'LATE', checkInAt: '2026-10-07T02:00:00Z', checkInIsOutside: true }),
      row({ userId: 3, name: 'C', status: 'PRESENT', checkInAt: '2026-10-07T03:00:00Z' }),
    ];
    expect(outsidePeople(rows, 5)).toEqual(['B', 'A']);
    expect(outsidePeople(rows, 1)).toEqual(['B']);
  });
});

function overviewDay(date: string, present: number, late: number, absent: number, outside = 0): DailyOverviewRow {
  return { date, present, late, absent, away: 0, outside };
}

describe('daysBetween', () => {
  it('counts calendar days across a month end', () => {
    expect(daysBetween('2026-09-30', '2026-10-02')).toBe(2);
    expect(daysBetween('2026-10-07', '2026-10-07')).toBe(0);
  });
});

describe('buildDaySeries', () => {
  it('drops today and days with nobody expected, sorted oldest first', () => {
    const series = buildDaySeries(
      [
        overviewDay('2026-10-06', 8, 1, 1),
        overviewDay('2026-10-03', 0, 0, 0), // a Saturday with only leave rows
        overviewDay('2026-10-02', 9, 0, 1, 2),
        overviewDay(TODAY, 3, 0, 0), // today is never in the history
      ],
      TODAY,
    );
    expect(series.map((d) => d.date)).toEqual(['2026-10-02', '2026-10-06']);
    expect(series[0]).toMatchObject({ daysAgo: 5, attended: 9, obligated: 10, rate: 90, outside: 2 });
    expect(series[1]).toMatchObject({ daysAgo: 1, hadir: 9, late: 1, absent: 1, rate: 90 });
  });
});

describe('trendPoints and averageRate', () => {
  const series = buildDaySeries([overviewDay('2026-10-01', 9, 1, 0), overviewDay('2026-10-05', 5, 0, 5), overviewDay('2026-10-06', 10, 0, 0)], TODAY);

  it('keeps only the requested window, with labels', () => {
    const week = trendPoints(series, 3);
    expect(week.map((p) => p.id)).toEqual(['2026-10-05', '2026-10-06']);
    expect(week[0]).toMatchObject({ label: '5 Okt', weekday: 'Sen', value: 50 });
  });

  it('weights the average by people expected, not by day', () => {
    // 10/10, 5/10, 10/10 -> 25/30
    expect(averageRate(trendPoints(series, 30))).toBe(83.3);
    expect(averageRate([])).toBeNull();
  });
});

describe('buildKpis', () => {
  const stats = summarizeToday(roster); // hadir 3, late 1, belum 2, outside 1, rate 60
  const links = { hadir: '/a', terlambat: '/t', belum: '/l', luar: '/o', rate: '/s' };
  const series = buildDaySeries([overviewDay('2026-10-05', 4, 1, 0), overviewDay('2026-10-06', 3, 1, 1)], TODAY);

  it('compares with the same time on the last working day', () => {
    const snapshot: SameTimeSnapshot = { date: '2026-10-06', expected: 5, attended: 4, late: 0, outside: 2 };
    const { items, refLabel } = buildKpis(stats, series, snapshot, TODAY, links);
    expect(refLabel).toBe('kemarin');
    const byId = Object.fromEntries(items.map((k) => [k.id, k]));
    // 3 hadir against 4 at this time yesterday: down, and that is bad news.
    expect(byId.hadir!.delta).toEqual({ diff: -1, direction: 'down', tone: 'bad' });
    // 1 late against 0: up, bad. 1 outside against 2: down, good.
    expect(byId.terlambat!.delta).toMatchObject({ diff: 1, direction: 'up', tone: 'bad' });
    expect(byId.luar!.delta).toMatchObject({ diff: -1, direction: 'down', tone: 'good' });
    // 2 belum against 1 (5 expected - 4 attended): up, bad.
    expect(byId.belum!.delta).toMatchObject({ diff: 1, direction: 'up', tone: 'bad' });
    // 60% against 80%: percentage points.
    expect(byId.rate!.delta).toMatchObject({ diff: -20, direction: 'down', tone: 'bad' });
    expect(byId.rate!.href).toBe('/s');
  });

  it('sparklines are the last working days of each figure', () => {
    const { items } = buildKpis(stats, series, { date: null, expected: 0, attended: 0, late: 0, outside: 0 }, TODAY, links);
    expect(items.find((k) => k.id === 'hadir')!.spark).toEqual([5, 4]);
    expect(items.find((k) => k.id === 'terlambat')!.spark).toEqual([1, 1]);
    expect(items.find((k) => k.id === 'belum')!.spark).toEqual([0, 1]);
  });

  it('shows no delta when there is nothing to compare with', () => {
    const { items, refLabel } = buildKpis(stats, [], { date: null, expected: 0, attended: 0, late: 0, outside: 0 }, TODAY, links);
    expect(refLabel).toBeNull();
    expect(items.every((k) => k.delta === null)).toBe(true);
  });

  it('a flat change is neutral, not good or bad', () => {
    const snapshot: SameTimeSnapshot = { date: '2026-10-06', expected: 5, attended: 3, late: 1, outside: 1 };
    const { items } = buildKpis(stats, series, snapshot, TODAY, links);
    expect(items.find((k) => k.id === 'hadir')!.delta).toEqual({ diff: 0, direction: 'flat', tone: 'neutral' });
  });

  it('leaves the rate empty (and without delta) when nobody is expected', () => {
    const { items } = buildKpis(summarizeToday([]), series, { date: '2026-10-06', expected: 5, attended: 4, late: 0, outside: 0 }, TODAY, links);
    const rate = items.find((k) => k.id === 'rate')!;
    expect(rate.value).toBeNull();
    expect(rate.delta).toBeNull();
  });
});

describe('referenceLabel', () => {
  it('says "kemarin" for yesterday and the weekday otherwise', () => {
    expect(referenceLabel('2026-10-06', TODAY)).toBe('kemarin');
    expect(referenceLabel('2026-10-02', TODAY)).toBe('Jum');
    expect(referenceLabel(null, TODAY)).toBeNull();
  });
});

describe('buildHourSeries', () => {
  it('pads to at least six hours around the activity and finds the peak', () => {
    const today = new Map([
      [8, 5],
      [9, 2],
    ]);
    const s = buildHourSeries(today, [{ hour: 8, count: 28 }], 14);
    expect(s.bars.length).toBeGreaterThanOrEqual(6);
    expect(s.bars[0]!.hour).toBe(7);
    expect(s.peakHour).toBe(8);
    expect(s.totalToday).toBe(7);
    expect(s.bars.find((b) => b.hour === 8)).toMatchObject({ today: 5, usual: 2 });
  });

  it('has no baseline without past working days', () => {
    const s = buildHourSeries(new Map([[8, 1]]), [{ hour: 8, count: 10 }], 0);
    expect(s.usualDays).toBe(0);
    expect(s.bars.every((b) => b.usual === 0)).toBe(true);
  });

  it('is empty before any check-in and any history', () => {
    expect(buildHourSeries(new Map(), [], 0)).toEqual({ bars: [], totalToday: 0, peakHour: null, usualDays: 0 });
  });

  it('ignores hours outside 0..23', () => {
    const s = buildHourSeries(new Map([[25, 3]]), [{ hour: -1, count: 9 }], 3);
    expect(s.bars).toEqual([]);
  });
});

describe('weekStartOf and buildHeatmap', () => {
  it('finds the Monday of the ISO week', () => {
    expect(weekStartOf('2026-10-07')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
  });

  const series = buildDaySeries([overviewDay('2026-10-05', 9, 0, 1), overviewDay('2026-10-06', 10, 0, 0), overviewDay('2026-09-26', 5, 0, 0)], TODAY);

  it('lays the last weeks out as weekday rows and week columns', () => {
    const heat = buildHeatmap(series, TODAY, 3);
    expect(heat.weeks.map((w) => w.start)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05']);
    // Saturday 26 Sep had people expected, so a Sat row appears; Sunday never did.
    expect(heat.rows.map((r) => r.label)).toEqual(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']);
    expect(heat.cells).toHaveLength(18);
    expect(heat.hasData).toBe(true);
    const cell = (date: string) => heat.cells.find((c) => c.date === date)!;
    expect(cell('2026-10-05')).toMatchObject({ state: 'data', rate: 90, week: 2, row: 0 });
    expect(cell('2026-10-06')).toMatchObject({ state: 'data', rate: 100 });
    expect(cell('2026-10-07')).toMatchObject({ state: 'today', rate: null });
    expect(cell('2026-10-08')).toMatchObject({ state: 'future' });
    expect(cell('2026-09-22')).toMatchObject({ state: 'empty' });
  });

  it('reports no data for a history-less organisation', () => {
    expect(buildHeatmap([], TODAY, 5).hasData).toBe(false);
  });
});

describe('heatLevel', () => {
  it('steps from 1 (weak) to 5 (everyone)', () => {
    expect([50, 78, 88, 94, 98, 100].map(heatLevel)).toEqual([1, 2, 3, 4, 5, 5]);
    expect(heatLevel(77.9)).toBe(1);
  });
});

describe('buildAttentionRows', () => {
  const base: AttentionData = {
    late: { count: 0, top: [] },
    outside: { count: 0, names: [] },
    pending: { count: 0, oldestDays: null },
  };

  it('is empty (all clear) when nothing needs action', () => {
    expect(buildAttentionRows(base)).toEqual([]);
  });

  it('puts what needs action first, quiet rows after, in priority order', () => {
    const rows = buildAttentionRows({ ...base, outside: { count: 1, names: ['Dewi'] }, pending: { count: 2, oldestDays: 3 } });
    expect(rows.map((r) => r.id)).toEqual(['pending', 'outside', 'late']);
    expect(rows[0]).toMatchObject({ title: '2 permintaan menunggu', sub: 'Yang tertua 3 hari lalu', href: '/app/requests' });
    expect(rows[1]).toMatchObject({ title: '1 di luar area', sub: 'Dewi', href: '/app/luar-area' });
    expect(rows[2]).toMatchObject({ count: 0, title: 'Tidak ada yang terlambat', sub: null });
  });

  it('names the worst arrivals with their minutes and says how many more', () => {
    const rows = buildAttentionRows({
      ...base,
      late: {
        count: 5,
        top: [
          { userId: 1, name: 'Budi', lateMinutes: 75 },
          { userId: 2, name: 'Ani', lateMinutes: 30 },
        ],
      },
    });
    expect(rows[0]).toMatchObject({ id: 'late', title: '5 terlambat', sub: 'Budi 1 j 15 mnt, Ani 30 mnt +3 lagi' });
  });

  it('a request that came in today says so', () => {
    const rows = buildAttentionRows({ ...base, pending: { count: 1, oldestDays: 0 } });
    expect(rows[0]!.sub).toBe('Yang tertua masuk hari ini');
  });
});

describe('buildSetupSteps', () => {
  it('ticks each step from its own count', () => {
    const steps = buildSetupSteps({ branches: 1, shifts: 0, trackedPeople: 0, hasOwnCheckIn: false });
    expect(steps.map((s) => [s.id, s.done])).toEqual([
      ['branch', true],
      ['shift', false],
      ['people', false],
      ['checkin', false],
    ]);
    expect(steps.map((s) => s.href)).toEqual(['/app/branches', '/app/shifts', '/app/employees', '/app/check-in']);
  });
});

describe('formatting', () => {
  it('formatSigned uses a hyphen, never a real minus', () => {
    expect(formatSigned(2)).toBe('+2');
    expect(formatSigned(-1.5)).toBe('-1,5');
    expect(formatSigned(0)).toBe('0');
  });

  it('formatPercent and formatMinutes', () => {
    expect(formatPercent(93.2)).toBe('93,2%');
    expect(formatPercent(null)).toBe('—');
    expect(formatMinutes(35)).toBe('35 mnt');
    expect(formatMinutes(65)).toBe('1 j 5 mnt');
    expect(formatMinutes(120)).toBe('2 j');
    expect(formatMinutes(-4)).toBe('0 mnt');
  });

  it('formatClock shows the organisation clock', () => {
    expect(formatClock('2026-10-07T01:02:00Z', 'Asia/Jakarta')).toBe('08.02');
    expect(formatClock('2026-10-07T01:02:00Z', 'Asia/Makassar')).toBe('09.02');
    expect(formatClock('2026-10-07T01:02:00Z', 'Asia/Jayapura')).toBe('10.02');
  });
});
