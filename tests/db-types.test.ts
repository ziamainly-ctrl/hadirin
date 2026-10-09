import { describe, it, expect } from 'vitest';
import { dbTypes, parseInt8, OID_INT8, OID_INT8_ARRAY, OID_DATE } from '../lib/db-types';

// Regression for the digit-string coercion that replaced it: lib/db.ts used to turn EVERY all-digit
// string in a result into a number, so a phone "081234567890" lost its leading 0, an employee code
// "007" became 7, and the Saturday-only shift's work_days "6" became the number 6 (which crashed
// /app/shifts with "workDays.split is not a function"). Parsing is now by Postgres column type.
describe('dbTypes', () => {
  const OID_VARCHAR = 1043;
  const OID_TEXT = 25;
  const OID_NUMERIC = 1700;
  const OID_INT4 = 23;
  const OID_TIMESTAMPTZ = 1184;

  it('parses int8 (BIGSERIAL ids, count(*)) as a number', () => {
    const parse = dbTypes.getTypeParser(OID_INT8);
    expect(parse('42')).toBe(42);
    expect(parse('0')).toBe(0);
    expect(parse('-7')).toBe(-7);
  });

  it('keeps an int8 beyond the safe integer range as text (no silent precision loss)', () => {
    expect(parseInt8('99999999999999999999')).toBe('99999999999999999999');
  });

  it('keeps an all-digit varchar/text exactly as stored (phone, employee code, work_days)', () => {
    for (const oid of [OID_VARCHAR, OID_TEXT]) {
      const parse = dbTypes.getTypeParser(oid);
      expect(parse('081234567890')).toBe('081234567890');
      expect(parse('007')).toBe('007');
      expect(parse('6')).toBe('6');
    }
  });

  it('keeps numeric as text, including a whole-number value (lat/lng columns, avg())', () => {
    const parse = dbTypes.getTypeParser(OID_NUMERIC);
    expect(parse('6')).toBe('6');
    expect(parse('-6.208800')).toBe('-6.208800');
  });

  it('leaves int4 to the default parser (already a number)', () => {
    expect(dbTypes.getTypeParser(OID_INT4)('5')).toBe(5);
  });

  it('returns a DATE as its calendar-date text, not a JS Date at local midnight', () => {
    expect(dbTypes.getTypeParser(OID_DATE)('2026-10-08')).toBe('2026-10-08');
  });

  it('parses an int8[] as numbers', () => {
    expect(dbTypes.getTypeParser(OID_INT8_ARRAY)('{1,2,30}')).toEqual([1, 2, 30]);
  });

  it('leaves timestamptz to the default parser (a Date)', () => {
    const value = dbTypes.getTypeParser(OID_TIMESTAMPTZ)('2026-10-07 23:02:22.363+00');
    expect(value).toBeInstanceOf(Date);
    expect((value as Date).toISOString()).toBe('2026-10-07T23:02:22.363Z');
  });
});
