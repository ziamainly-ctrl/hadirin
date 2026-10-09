import { describe, it, expect } from 'vitest';
import { firstValue, hrefWith, lastPage, parseOneOf, parsePageNumber, parsePositiveInt, scopeFor } from '../lib/insights-params';
import { LATE_CATEGORY_A_MAX_MIN, LATE_CATEGORY_B_MAX_MIN } from '../lib/insights-constants';
import { lateCategory } from '../lib/attendance-rules';

describe('firstValue', () => {
  it('takes the first of a repeated param', () => {
    expect(firstValue(['a', 'b'])).toBe('a');
    expect(firstValue('a')).toBe('a');
    expect(firstValue(undefined)).toBeUndefined();
  });
});

describe('parsePositiveInt / parsePageNumber', () => {
  it('accepts positive integers only', () => {
    expect(parsePositiveInt('3')).toBe(3);
    expect(parsePositiveInt('0')).toBeUndefined();
    expect(parsePositiveInt('-2')).toBeUndefined();
    expect(parsePositiveInt('1.5')).toBeUndefined();
    expect(parsePositiveInt('abc')).toBeUndefined();
    expect(parsePositiveInt('1; DROP TABLE users')).toBeUndefined();
    expect(parsePositiveInt('')).toBeUndefined();
    expect(parsePositiveInt(undefined)).toBeUndefined();
  });
  it('a bad page is page 1', () => {
    expect(parsePageNumber('4')).toBe(4);
    expect(parsePageNumber('x')).toBe(1);
    expect(parsePageNumber('0')).toBe(1);
    expect(parsePageNumber(undefined)).toBe(1);
  });
});

describe('parseOneOf', () => {
  const tabs = ['late', 'detail', 'early'] as const;
  it('keeps a listed value and falls back otherwise', () => {
    expect(parseOneOf('early', tabs, 'late')).toBe('early');
    expect(parseOneOf('nope', tabs, 'late')).toBe('late');
    expect(parseOneOf(undefined, tabs, 'late')).toBe('late');
    expect(parseOneOf('__proto__', tabs, 'late')).toBe('late');
  });
});

describe('lastPage', () => {
  it('is at least 1 and rounds up', () => {
    expect(lastPage(0, 25)).toBe(1);
    expect(lastPage(25, 25)).toBe(1);
    expect(lastPage(26, 25)).toBe(2);
  });
});

describe('scopeFor (role scoping)', () => {
  it('OWNER and ADMIN are org-wide: no managerId', () => {
    expect(scopeFor('OWNER', 1, undefined)).toEqual({ branchId: undefined });
    expect(scopeFor('ADMIN', 2, 5)).toEqual({ branchId: 5 });
    expect(scopeFor('ADMIN', 2, 5)).not.toHaveProperty('managerId');
  });
  it('MANAGER is scoped to their own id, whatever the URL says', () => {
    expect(scopeFor('MANAGER', 3, 5)).toEqual({ branchId: 5, managerId: 3 });
  });
  it('EMPLOYEE has no scope at all', () => {
    expect(scopeFor('EMPLOYEE', 4, undefined)).toBeNull();
  });
});

describe('late category thresholds', () => {
  it('the SQL thresholds match lateCategory() in lib/attendance-rules.ts', () => {
    expect(lateCategory(LATE_CATEGORY_A_MAX_MIN)).toBe('A');
    expect(lateCategory(LATE_CATEGORY_A_MAX_MIN + 1)).toBe('B');
    expect(lateCategory(LATE_CATEGORY_B_MAX_MIN)).toBe('B');
    expect(lateCategory(LATE_CATEGORY_B_MAX_MIN + 1)).toBe('C');
  });
});

describe('hrefWith', () => {
  it('builds a query from the current params and overrides', () => {
    expect(hrefWith('/app/terlambat', { dateFrom: '2026-10-01', tab: 'early' }, { tab: 'forgot' })).toBe(
      '/app/terlambat?dateFrom=2026-10-01&tab=forgot',
    );
  });
  it('drops empty values and the page number', () => {
    expect(hrefWith('/app/x', { a: '1', page: '3', b: undefined, c: '' })).toBe('/app/x?a=1');
    expect(hrefWith('/app/x', { a: '1' }, { a: undefined })).toBe('/app/x');
  });
  it('encodes values', () => {
    expect(hrefWith('/app/x', { q: 'a b&c' })).toBe('/app/x?q=a+b%26c');
  });
});
