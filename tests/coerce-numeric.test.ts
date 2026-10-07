import { describe, it, expect } from 'vitest';
import { coerceNumericStrings } from '../lib/coerce-numeric';

// Regression test for the bug that once broke login/registration end-to-end (lib/db.ts's
// own comment, TRD.md §5): @neondatabase/serverless returns every bigint column as a
// string, which silently failed `typeof payload.org === 'number'` in lib/session.ts.
describe('coerceNumericStrings', () => {
  it('converts a bare digit string to a number', () => {
    expect(coerceNumericStrings('42')).toBe(42);
    expect(coerceNumericStrings('0')).toBe(0);
  });

  it('converts a negative digit string to a number', () => {
    expect(coerceNumericStrings('-7')).toBe(-7);
  });

  it('leaves a non-numeric string untouched', () => {
    expect(coerceNumericStrings('KSS-001')).toBe('KSS-001');
    expect(coerceNumericStrings('+6281200000001')).toBe('+6281200000001');
    expect(coerceNumericStrings('2026-10-07')).toBe('2026-10-07');
    expect(coerceNumericStrings('07:00:00')).toBe('07:00:00');
    expect(coerceNumericStrings('')).toBe('');
  });

  it('leaves a digit string outside the safe integer range as a string (no silent precision loss)', () => {
    const huge = '99999999999999999999';
    expect(coerceNumericStrings(huge)).toBe(huge);
  });

  it('does not touch a Date instance (the exact regression: dates were reduced to {})', () => {
    const date = new Date('2026-10-07T06:15:09.093Z');
    const result = coerceNumericStrings(date);
    expect(result).toBe(date);
    expect(result instanceof Date).toBe(true);
    expect(result.toISOString()).toBe('2026-10-07T06:15:09.093Z');
  });

  it('recurses into a plain object, converting only its numeric-string fields', () => {
    const row = {
      id: '14',
      orgId: '6',
      name: 'Smoke Tester',
      phone: '+6281200000001',
      createdAt: new Date('2026-10-07T06:15:09.093Z'),
    };
    const result = coerceNumericStrings(row);
    expect(result.id).toBe(14);
    expect(result.orgId).toBe(6);
    expect(result.name).toBe('Smoke Tester');
    expect(result.phone).toBe('+6281200000001');
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('recurses into an array of rows (the actual sql.query() result shape)', () => {
    const rows = [{ id: '1' }, { id: '2' }];
    expect(coerceNumericStrings(rows)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('recurses into nested jsonb-shaped objects (e.g. plans.features)', () => {
    const value = { features: { export_xlsx: true, limit: '5' } };
    expect(coerceNumericStrings(value)).toEqual({ features: { export_xlsx: true, limit: 5 } });
  });

  it('passes through null, undefined, booleans and real numbers unchanged', () => {
    expect(coerceNumericStrings(null)).toBeNull();
    expect(coerceNumericStrings(undefined)).toBeUndefined();
    expect(coerceNumericStrings(true)).toBe(true);
    expect(coerceNumericStrings(7)).toBe(7);
  });
});
