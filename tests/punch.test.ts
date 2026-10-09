import { describe, it, expect } from 'vitest';
import {
  CHECKOUT_GRACE_HOURS,
  checkoutDeadline,
  classifyCheckIn,
  dayKindFor,
  isCloseable,
  isoWeekday,
  isWorkDay,
  pickOpenLog,
  resolvePunchTarget,
  type OpenLogLike,
} from '../lib/punch';

const TZ = 'Asia/Jakarta';

// Fixtures: ERD.md §4 seed. 2026-10-07 is a Wednesday. Shifts: Pagi 07:00-15:00 (tol 10, Mon-Sat),
// Kantor 08:00-17:00 (tol 15, Mon-Fri).
const PAGI = { timeIn: '07:00', timeOut: '15:00', breakMinutes: 30, lateToleranceMinutes: 10, isCrossDay: false };
const KANTOR = { timeIn: '08:00', timeOut: '17:00', breakMinutes: 60, lateToleranceMinutes: 15, isCrossDay: false };
const NIGHT = { timeIn: '22:00', timeOut: '06:00', breakMinutes: 30, lateToleranceMinutes: 10, isCrossDay: true };

describe('isoWeekday / isWorkDay', () => {
  it('maps calendar dates to ISO weekdays (Monday 1 ... Sunday 7)', () => {
    expect(isoWeekday('2026-10-05')).toBe(1); // Monday
    expect(isoWeekday('2026-10-07')).toBe(3); // Wednesday
    expect(isoWeekday('2026-10-10')).toBe(6); // Saturday
    expect(isoWeekday('2026-10-11')).toBe(7); // Sunday
  });

  it('a Mon-Fri shift does not work on Saturday or Sunday; Pagi (Mon-Sat) works Saturday', () => {
    expect(isWorkDay('2026-10-07', '1,2,3,4,5')).toBe(true);
    expect(isWorkDay('2026-10-10', '1,2,3,4,5')).toBe(false);
    expect(isWorkDay('2026-10-11', '1,2,3,4,5')).toBe(false);
    expect(isWorkDay('2026-10-10', '1,2,3,4,5,6')).toBe(true);
  });

  it('a one-day shift ("6") works only that day, and a garbled list never matches', () => {
    expect(isWorkDay('2026-10-10', '6')).toBe(true);
    expect(isWorkDay('2026-10-07', '6')).toBe(false);
    expect(isWorkDay('2026-10-07', '')).toBe(false);
  });
});

describe('dayKindFor', () => {
  it('is WORK on a scheduled weekday, OFF on a weekday the shift skips, HOLIDAY wins over both', () => {
    expect(dayKindFor('2026-10-07', '1,2,3,4,5', null)).toBe('WORK');
    expect(dayKindFor('2026-10-10', '1,2,3,4,5', null)).toBe('OFF');
    expect(dayKindFor('2026-10-10', '1,2,3,4,5', 'Hari libur')).toBe('HOLIDAY');
    expect(dayKindFor('2026-10-07', '1,2,3,4,5', 'Hari libur')).toBe('HOLIDAY');
  });
});

describe('classifyCheckIn (ERD.md §3.2)', () => {
  it('log #2: Dewi, Pagi shift, 24 minutes late on a work day is LATE', () => {
    const r = classifyCheckIn({ now: new Date('2026-10-06T07:24:05+07:00'), workDate: '2026-10-06', shift: PAGI, timezone: TZ, dayKind: 'WORK' });
    expect(r).toEqual({ status: 'LATE', lateMinutes: 24 });
  });

  it('within tolerance stays PRESENT with 0 late minutes', () => {
    const r = classifyCheckIn({ now: new Date('2026-10-06T07:05:00+07:00'), workDate: '2026-10-06', shift: PAGI, timezone: TZ, dayKind: 'WORK' });
    expect(r).toEqual({ status: 'PRESENT', lateMinutes: 0 });
  });

  it('the same late arrival on an OFF day or a HOLIDAY is PRESENT, never LATE (ERD 3.2: holidays and off days do not block check-in)', () => {
    const late = new Date('2026-10-10T09:30:00+07:00'); // Saturday, Kantor works Mon-Fri
    expect(classifyCheckIn({ now: late, workDate: '2026-10-10', shift: KANTOR, timezone: TZ, dayKind: 'OFF' })).toEqual({
      status: 'PRESENT',
      lateMinutes: 0,
    });
    expect(classifyCheckIn({ now: late, workDate: '2026-10-10', shift: KANTOR, timezone: TZ, dayKind: 'HOLIDAY' })).toEqual({
      status: 'PRESENT',
      lateMinutes: 0,
    });
  });
});

function open(overrides: Partial<OpenLogLike> = {}): OpenLogLike {
  return {
    id: 1,
    workDate: '2026-10-07',
    checkInAt: '2026-10-07T07:00:00+07:00',
    checkOutAt: null,
    scheduledIn: '07:00:00',
    scheduledOut: '15:00:00',
    shiftIsCrossDay: false,
    ...overrides,
  };
}

describe('check-out window', () => {
  it('lasts until the scheduled end plus 6 hours', () => {
    expect(CHECKOUT_GRACE_HOURS).toBe(6);
    const deadline = checkoutDeadline(open(), TZ)!;
    expect(deadline.toISOString()).toBe(new Date('2026-10-07T21:00:00+07:00').toISOString());
  });

  it('a normal shift is closeable before the deadline and not after it', () => {
    expect(isCloseable(open(), new Date('2026-10-07T15:04:40+07:00'), TZ)).toBe(true);
    expect(isCloseable(open(), new Date('2026-10-07T20:59:00+07:00'), TZ)).toBe(true);
    expect(isCloseable(open(), new Date('2026-10-07T21:01:00+07:00'), TZ)).toBe(false);
  });

  it('a log that is already closed, or has no check-in, is never closeable', () => {
    expect(isCloseable(open({ checkOutAt: '2026-10-07T15:00:00+07:00' }), new Date('2026-10-07T15:10:00+07:00'), TZ)).toBe(false);
    expect(isCloseable(open({ checkInAt: null }), new Date('2026-10-07T15:10:00+07:00'), TZ)).toBe(false);
  });

  it('overtime past midnight on a normal shift: checked in at 07:00, still open at 00:30 the next day is NOT closeable (needs a correction)', () => {
    expect(isCloseable(open(), new Date('2026-10-08T00:30:00+07:00'), TZ)).toBe(false);
  });

  it('a 22:00-06:00 night shift opened on 10-08 stays closeable at 06:01 on 10-09 (the defect: workDate re-derived from now gave the wrong day)', () => {
    const night = open({ workDate: '2026-10-08', checkInAt: '2026-10-08T21:58:00+07:00', scheduledIn: '22:00:00', scheduledOut: '06:00:00', shiftIsCrossDay: true });
    expect(isCloseable(night, new Date('2026-10-09T06:01:00+07:00'), TZ)).toBe(true);
    expect(isCloseable(night, new Date('2026-10-09T11:59:00+07:00'), TZ)).toBe(true);
    expect(isCloseable(night, new Date('2026-10-09T12:30:00+07:00'), TZ)).toBe(false);
  });

  it('a REQUEST row without a scheduled end falls back to 16 hours after the check-in', () => {
    const noSchedule = open({ scheduledOut: null });
    expect(isCloseable(noSchedule, new Date('2026-10-07T22:00:00+07:00'), TZ)).toBe(true);
    expect(isCloseable(noSchedule, new Date('2026-10-08T00:00:00+07:00'), TZ)).toBe(false);
  });
});

describe('pickOpenLog', () => {
  it('returns the newest closeable log and ignores closed or expired ones', () => {
    const now = new Date('2026-10-07T16:00:00+07:00');
    const old = open({ id: 1, workDate: '2026-10-06', checkInAt: '2026-10-06T07:00:00+07:00' });
    const today = open({ id: 2 });
    const closed = open({ id: 3, checkOutAt: '2026-10-07T15:00:00+07:00' });
    expect(pickOpenLog([old, today, closed], now, TZ)?.id).toBe(2);
    expect(pickOpenLog([old], now, TZ)).toBeNull();
    expect(pickOpenLog([], now, TZ)).toBeNull();
  });
});

describe('resolvePunchTarget', () => {
  const base = { timezone: TZ, shift: PAGI };
  const row = (over: Record<string, unknown> = {}) => ({ workDate: '2026-10-07', checkInAt: null as string | null, checkOutAt: null as string | null, ...over });

  it('nothing recorded -> check-in for today', () => {
    const r = resolvePunchTarget({ ...base, now: new Date('2026-10-07T06:50:00+07:00'), todayLog: null, openLog: null });
    expect(r.action).toBe('check-in');
    expect(r.workDate).toBe('2026-10-07');
  });

  it('today checked in, not out, within the window -> check-out of that log', () => {
    const o = open();
    const r = resolvePunchTarget({ ...base, now: new Date('2026-10-07T12:00:00+07:00'), todayLog: row({ checkInAt: o.checkInAt }), openLog: o });
    expect(r.action).toBe('check-out');
    expect(r.log).toBe(o);
  });

  it('an open log of the previous date that is still closeable wins over a missing today row (cross-day shift)', () => {
    const night = open({ id: 9, workDate: '2026-10-08', checkInAt: '2026-10-08T21:58:00+07:00', scheduledOut: '06:00:00', shiftIsCrossDay: true });
    const r = resolvePunchTarget({ timezone: TZ, shift: NIGHT, now: new Date('2026-10-09T06:10:00+07:00'), todayLog: null, openLog: night });
    expect(r.action).toBe('check-out');
    expect(r.workDate).toBe('2026-10-08');
  });

  it('both times recorded -> done', () => {
    const r = resolvePunchTarget({
      ...base,
      now: new Date('2026-10-07T16:00:00+07:00'),
      todayLog: row({ checkInAt: '2026-10-07T07:00:00+07:00', checkOutAt: '2026-10-07T15:00:00+07:00' }),
      openLog: null,
    });
    expect(r.action).toBe('done');
  });

  it('a row without a check-in (approved leave / sick / absent / holiday) -> recorded, nothing to punch', () => {
    const r = resolvePunchTarget({ ...base, now: new Date('2026-10-07T07:00:00+07:00'), todayLog: row(), openLog: null });
    expect(r.action).toBe('recorded');
  });

  it('checked in but the window has closed -> expired (file a correction); yesterday does not block tomorrow', () => {
    const stale = open({ id: 5, workDate: '2026-10-06', checkInAt: '2026-10-06T07:00:00+07:00' });
    const r = resolvePunchTarget({ ...base, now: new Date('2026-10-07T06:55:00+07:00'), todayLog: null, openLog: stale });
    expect(r.action).toBe('check-in');
    const expired = open({ id: 6, checkInAt: '2026-10-07T07:00:00+07:00' });
    const e = resolvePunchTarget({
      ...base,
      now: new Date('2026-10-07T22:00:00+07:00'),
      todayLog: row({ checkInAt: expired.checkInAt }),
      openLog: expired,
    });
    expect(e.action).toBe('expired');
  });
});

describe('one-day shifts (work_days = "6")', () => {
  // lib/db.ts coerces every all-digit string to a number, so a shift worked on a single weekday reaches
  // the rules as the number 6, not the string "6". The rules must not crash on it.
  it('isWorkDay and dayKindFor accept the coerced number', () => {
    expect(isWorkDay('2026-10-10', 6)).toBe(true);
    expect(isWorkDay('2026-10-08', 6)).toBe(false);
    expect(dayKindFor('2026-10-08', 1, null)).toBe('OFF');
    expect(dayKindFor('2026-10-05', 1, null)).toBe('WORK');
  });
});
