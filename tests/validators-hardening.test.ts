import { describe, it, expect } from 'vitest';
import { dateStringSchema, isRealCalendarDate, timeStringSchema } from '../lib/validators/common';
import { upsertShiftSchema } from '../lib/validators/shifts';
import { updateOrganizationSchema } from '../lib/validators/organizations';

const shift = { name: 'Pagi', timeIn: '08:00', timeOut: '17:00', breakMinutes: 60, lateToleranceMinutes: 10, workDays: '1,2,3,4,5', isCrossDay: false };

describe('dateStringSchema', () => {
  it('accepts real calendar dates, including a leap day', () => {
    expect(dateStringSchema.safeParse('2026-10-08').success).toBe(true);
    expect(dateStringSchema.safeParse('2028-02-29').success).toBe(true);
  });
  it('refuses a date that has the shape but is not a day (it reached Postgres as a 500)', () => {
    expect(isRealCalendarDate('2026-02-31')).toBe(false);
    expect(dateStringSchema.safeParse('2026-02-29').success).toBe(false);
    expect(dateStringSchema.safeParse('2026-13-01').success).toBe(false);
    expect(dateStringSchema.safeParse('2026-00-10').success).toBe(false);
    expect(dateStringSchema.safeParse('2026-10-8').success).toBe(false);
  });
});

describe('timeStringSchema', () => {
  it('accepts HH:MM and HH:MM:SS within range', () => {
    expect(timeStringSchema.safeParse('08:00').success).toBe(true);
    expect(timeStringSchema.safeParse('23:59:59').success).toBe(true);
  });
  it('refuses 99:99 and 24:00', () => {
    expect(timeStringSchema.safeParse('99:99').success).toBe(false);
    expect(timeStringSchema.safeParse('24:00').success).toBe(false);
    expect(timeStringSchema.safeParse('12:60').success).toBe(false);
  });
});

describe('upsertShiftSchema', () => {
  it('accepts a normal day shift and a flagged overnight shift', () => {
    expect(upsertShiftSchema.safeParse(shift).success).toBe(true);
    expect(upsertShiftSchema.safeParse({ ...shift, timeIn: '22:00', timeOut: '06:00', isCrossDay: true }).success).toBe(true);
  });
  it('refuses equal times', () => {
    expect(upsertShiftSchema.safeParse({ ...shift, timeOut: '08:00' }).success).toBe(false);
  });
  it('refuses a cross-day flag that disagrees with the times, on the timeOut field', () => {
    const overnightUnflagged = upsertShiftSchema.safeParse({ ...shift, timeIn: '22:00', timeOut: '06:00', isCrossDay: false });
    expect(overnightUnflagged.success).toBe(false);
    expect(!overnightUnflagged.success && overnightUnflagged.error.issues[0]?.path).toEqual(['timeOut']);
    expect(upsertShiftSchema.safeParse({ ...shift, isCrossDay: true }).success).toBe(false);
  });
  it('caps the break at 8 h and the tolerance at 3 h', () => {
    expect(upsertShiftSchema.safeParse({ ...shift, breakMinutes: 481 }).success).toBe(false);
    expect(upsertShiftSchema.safeParse({ ...shift, lateToleranceMinutes: 181 }).success).toBe(false);
    expect(upsertShiftSchema.safeParse({ ...shift, breakMinutes: 480, lateToleranceMinutes: 180 }).success).toBe(true);
  });
});

describe('updateOrganizationSchema', () => {
  it('accepts an IANA zone and refuses a string Intl rejects', () => {
    expect(updateOrganizationSchema.safeParse({ timezone: 'Asia/Makassar' }).success).toBe(true);
    expect(updateOrganizationSchema.safeParse({ timezone: 'Foo/Bar' }).success).toBe(false);
    expect(updateOrganizationSchema.safeParse({ timezone: 'WIB' }).success).toBe(false);
  });
});
