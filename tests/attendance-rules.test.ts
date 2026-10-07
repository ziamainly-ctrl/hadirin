import { describe, it, expect } from 'vitest';
import { computeWorkDate, lateMinutes, earlyLeaveMinutes, workMinutes, lateCategory } from '../lib/attendance-rules';

const TZ = 'Asia/Jakarta';

// Fixtures: ERD.md §4 seed, org 1, shifts Pagi(07:00-15:00,brk30,tol10),
// Siang(14:00-22:00,brk30,tol10), Kantor(08:00-17:00,brk60,tol15).
describe('attendance-rules (seed fixtures, ERD.md §4)', () => {
  it('log #2 — Dewi, Pagi shift, late by 24 minutes', () => {
    const shift = { timeIn: '07:00', timeOut: '15:00', breakMinutes: 30, lateToleranceMinutes: 10, isCrossDay: false };
    const checkIn = new Date('2026-10-06T07:24:05+07:00');
    const checkOut = new Date('2026-10-06T15:02:11+07:00');
    expect(lateMinutes(checkIn, '2026-10-06', shift, TZ)).toBe(24);
    expect(lateCategory(24)).toBe('B');
    expect(workMinutes(checkIn, checkOut, shift.breakMinutes)).toBe(428);
  });

  it('log #4 — Rizky, Siang shift, early check-in stays PRESENT (0 late minutes)', () => {
    const shift = { timeIn: '14:00', timeOut: '22:00', breakMinutes: 30, lateToleranceMinutes: 10, isCrossDay: false };
    const checkIn = new Date('2026-10-05T13:55:31+07:00');
    const checkOut = new Date('2026-10-05T22:03:12+07:00');
    expect(lateMinutes(checkIn, '2026-10-05', shift, TZ)).toBe(0);
    expect(workMinutes(checkIn, checkOut, shift.breakMinutes)).toBe(457);
  });

  it('log #16 — Sari, Kantor shift, late by 18 minutes (tolerance 15)', () => {
    const shift = { timeIn: '08:00', timeOut: '17:00', breakMinutes: 60, lateToleranceMinutes: 15, isCrossDay: false };
    const checkIn = new Date('2026-10-06T08:18:05+07:00');
    const checkOut = new Date('2026-10-06T17:20:10+07:00');
    expect(lateMinutes(checkIn, '2026-10-06', shift, TZ)).toBe(18);
    expect(workMinutes(checkIn, checkOut, shift.breakMinutes)).toBe(482);
  });

  it('within tolerance stays PRESENT: 5 minutes late against a 10-minute tolerance', () => {
    const shift = { timeIn: '07:00', timeOut: '15:00', breakMinutes: 30, lateToleranceMinutes: 10, isCrossDay: false };
    const checkIn = new Date('2026-10-06T07:05:00+07:00');
    expect(lateMinutes(checkIn, '2026-10-06', shift, TZ)).toBe(0);
  });

  it('workMinutes never goes negative (checkout before checkin net of a long break)', () => {
    expect(workMinutes(new Date('2026-10-06T07:00:00+07:00'), new Date('2026-10-06T07:10:00+07:00'), 60)).toBe(0);
  });

  it('earlyLeaveMinutes is 0 on time or later, positive when leaving early', () => {
    const shift = { timeOut: '15:00', isCrossDay: false };
    expect(earlyLeaveMinutes(new Date('2026-10-06T15:00:00+07:00'), '2026-10-06', shift, TZ)).toBe(0);
    expect(earlyLeaveMinutes(new Date('2026-10-06T15:10:00+07:00'), '2026-10-06', shift, TZ)).toBe(0);
    expect(earlyLeaveMinutes(new Date('2026-10-06T14:40:00+07:00'), '2026-10-06', shift, TZ)).toBe(20);
  });

  it('lateCategory buckets A (<=15), B (<=30), C (>30), null when not late', () => {
    expect(lateCategory(0)).toBeNull();
    expect(lateCategory(15)).toBe('A');
    expect(lateCategory(16)).toBe('B');
    expect(lateCategory(30)).toBe('B');
    expect(lateCategory(31)).toBe('C');
  });
});

describe('computeWorkDate — cross-day shift (synthetic, no cross-day row exists in the seed)', () => {
  const nightShift = { timeOut: '06:00', isCrossDay: true };
  const dayShift = { timeOut: '15:00', isCrossDay: false };

  it('a non-cross-day shift always uses the local calendar date', () => {
    expect(computeWorkDate(new Date('2026-10-06T07:30:00+07:00'), TZ, dayShift)).toBe('2026-10-06');
  });

  it('a 22:00–06:00 shift: check-in in the evening belongs to that evening\'s date', () => {
    expect(computeWorkDate(new Date('2026-10-06T22:15:00+07:00'), TZ, nightShift)).toBe('2026-10-06');
  });

  it('a 22:00–06:00 shift: check-in at 02:00 the next calendar day still belongs to the previous date', () => {
    expect(computeWorkDate(new Date('2026-10-07T02:00:00+07:00'), TZ, nightShift)).toBe('2026-10-06');
  });

  it('a 22:00–06:00 shift: once past 06:00 it belongs to the new date (next shift\'s day)', () => {
    expect(computeWorkDate(new Date('2026-10-07T06:30:00+07:00'), TZ, nightShift)).toBe('2026-10-07');
  });
});
