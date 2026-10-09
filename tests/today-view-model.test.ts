import { describe, it, expect } from 'vitest';
import { buildWeek, minutesUntil, toTodayLogView, type LogSource } from '../lib/today-view-model';

const TZ = 'Asia/Jakarta';

const log: LogSource = {
  id: 3,
  workDate: '2026-10-07',
  status: 'PRESENT',
  scheduledOut: '15:00:00',
  checkInAt: '2026-10-07T06:57:30+07:00',
  checkOutAt: null,
  checkInBranchId: 1,
  checkOutBranchId: null,
  checkInDistanceM: 4,
  checkOutDistanceM: null,
  checkInIsOutside: false,
  checkOutIsOutside: false,
  checkInPhotoUrl: 'https://store.private.blob.vercel-storage.com/attendance/1/2026-10-06/4-in-abc.jpg',
  checkOutPhotoUrl: null,
  lateMinutes: 0,
  earlyLeaveMinutes: 0,
  workMinutes: null,
  note: null,
};

describe('toTodayLogView (ERD seed log #3: Dewi, 2026-10-07, checked in 06:57)', () => {
  const view = toTodayLogView(log, [{ id: 1, name: 'Klinik Kemang' }], { timeOut: '15:00:00', isCrossDay: false }, TZ);

  it('resolves the branch name and never exposes the private blob URL', () => {
    expect(view.checkInBranchName).toBe('Klinik Kemang');
    expect(view.checkOutBranchName).toBeNull();
    expect(view.hasCheckInPhoto).toBe(true);
    expect(view.hasCheckOutPhoto).toBe(false);
    expect(JSON.stringify(view)).not.toContain('blob.vercel-storage.com');
  });

  it('computes the scheduled end as an instant in the org timezone', () => {
    expect(view.scheduledOutAt).toBe(new Date('2026-10-07T15:00:00+07:00').toISOString());
  });

  it('a cross-day shift ends on the next calendar day', () => {
    const night = toTodayLogView(
      { ...log, workDate: '2026-10-08', scheduledOut: '06:00:00' },
      [],
      { timeOut: '06:00:00', isCrossDay: true },
      TZ,
    );
    expect(night.scheduledOutAt).toBe(new Date('2026-10-09T06:00:00+07:00').toISOString());
  });

  it('falls back to the shift\'s end for a row with no snapshot', () => {
    const v = toTodayLogView({ ...log, scheduledOut: null }, [], { timeOut: '17:00', isCrossDay: false }, TZ);
    expect(v.scheduledOutAt).toBe(new Date('2026-10-07T17:00:00+07:00').toISOString());
  });
});

describe('buildWeek', () => {
  it('is always seven days ending today, oldest first, with gaps as null', () => {
    const week = buildWeek('2026-10-07', [
      { workDate: '2026-10-05', status: 'PRESENT' },
      { workDate: '2026-10-06', status: 'LATE' },
      { workDate: '2026-10-07', status: 'PRESENT' },
    ]);
    expect(week.map((d) => d.date)).toEqual([
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
    ]);
    expect(week.map((d) => d.status)).toEqual([null, null, null, null, 'PRESENT', 'LATE', 'PRESENT']);
  });

  it('crosses a month boundary correctly and ignores rows outside the window', () => {
    const week = buildWeek('2026-11-02', [{ workDate: '2026-10-20', status: 'ABSENT' }]);
    expect(week[0]!.date).toBe('2026-10-27');
    expect(week[6]!.date).toBe('2026-11-02');
    expect(week.every((d) => d.status === null)).toBe(true);
  });

  it('accepts a work date that carries a time part', () => {
    expect(buildWeek('2026-10-07', [{ workDate: '2026-10-07T00:00:00.000Z', status: 'PRESENT' }])[6]!.status).toBe('PRESENT');
  });
});

describe('minutesUntil', () => {
  const now = new Date('2026-10-07T14:40:00+07:00').getTime();
  it('rounds up to whole minutes and is 0 once the time has passed or is unknown', () => {
    expect(minutesUntil('2026-10-07T15:00:00+07:00', now)).toBe(20);
    expect(minutesUntil('2026-10-07T14:40:30+07:00', now)).toBe(1);
    expect(minutesUntil('2026-10-07T14:00:00+07:00', now)).toBe(0);
    expect(minutesUntil(null, now)).toBe(0);
  });
});
