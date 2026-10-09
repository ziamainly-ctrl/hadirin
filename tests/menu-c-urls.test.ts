import { describe, it, expect } from 'vitest';
import { calendarHref } from '../app/app/kalender/calendar-url';
import { DEFAULT_DAYS, PERIOD_OPTIONS, parseDays, statistikHref } from '../app/app/statistik/statistik-url';
import { holidayKindLabel } from '../app/app/kalender/holiday-types';
import { describeNotificationFailure } from '../lib/insights/notification-failure';
import { eventLabel } from '../app/app/log-notifikasi/labels';

describe('calendarHref', () => {
  it('builds clean URLs and drops empty parts', () => {
    expect(calendarHref({})).toBe('/app/kalender');
    expect(calendarHref({ month: '2026-10' })).toBe('/app/kalender?month=2026-10');
    expect(calendarHref({ month: '2026-10', branchId: 3, day: '2026-10-06' })).toBe(
      '/app/kalender?month=2026-10&branchId=3&day=2026-10-06',
    );
    expect(calendarHref({ month: '2026-10', branchId: '' })).toBe('/app/kalender?month=2026-10');
  });
});

describe('statistik URL helpers', () => {
  it('parseDays only accepts the offered periods', () => {
    for (const d of PERIOD_OPTIONS) expect(parseDays(String(d))).toBe(d);
    expect(parseDays(undefined)).toBe(DEFAULT_DAYS);
    expect(parseDays('1000')).toBe(DEFAULT_DAYS);
    expect(parseDays('abc')).toBe(DEFAULT_DAYS);
  });

  it('statistikHref omits the default period', () => {
    expect(statistikHref({ days: 30 })).toBe('/app/statistik');
    expect(statistikHref({ days: 7 })).toBe('/app/statistik?days=7');
    expect(statistikHref({ days: 90, branchId: 2 })).toBe('/app/statistik?days=90&branchId=2');
    expect(statistikHref({ days: 30, branchId: '' })).toBe('/app/statistik');
  });
});

describe('holiday and notification labels', () => {
  it('holidayKindLabel tells company, collective leave and national apart', () => {
    expect(holidayKindLabel({ scope: 'COMPANY', isCollectiveLeave: false })).toBe('Libur perusahaan');
    expect(holidayKindLabel({ scope: 'COMPANY', isCollectiveLeave: true })).toBe('Cuti bersama perusahaan');
    expect(holidayKindLabel({ scope: 'NATIONAL', isCollectiveLeave: true })).toBe('Cuti bersama');
    expect(holidayKindLabel({ scope: 'NATIONAL', isCollectiveLeave: false })).toBe('Libur nasional');
  });

  it('eventLabel falls back when the template was deleted', () => {
    expect(eventLabel('LATE_CHECK_IN')).toBe('Karyawan terlambat');
    expect(eventLabel(null)).toBe('Notifikasi');
    expect(eventLabel('SOMETHING_NEW')).toBe('Notifikasi');
  });

  it('every failure maps to a reason and a hint', () => {
    for (const raw of ['ECONNREFUSED', 'Recipient number is not registered on WhatsApp', '550 mailbox unavailable', '535 auth failed', 'boom', null]) {
      const f = describeNotificationFailure(raw);
      expect(f.reason.length).toBeGreaterThan(0);
      expect(f.hint.length).toBeGreaterThan(0);
    }
  });
});
