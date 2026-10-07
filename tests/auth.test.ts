import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../lib/phone';
import { generateTemporaryPassword } from '../lib/password';

// lib/auth.ts re-exports both of these, but also pulls in 'server-only' and next/headers
// (Next.js-provided sentinels vitest can't resolve) — test the pure source modules
// directly instead of importing the full lib/auth.ts barrel.

describe('normalizePhone (TRD.md §11 — "08…" → "+628…")', () => {
  it('converts a local 08xxxxxxxxxx number to +62', () => {
    expect(normalizePhone('081234567890')).toBe('+6281234567890');
  });

  it('keeps an already-normalized +62 number as-is', () => {
    expect(normalizePhone('+6281234567890')).toBe('+6281234567890');
  });

  it('accepts a bare 62xxxxxxxxxx number and adds the +', () => {
    expect(normalizePhone('6281234567890')).toBe('+6281234567890');
  });

  it('strips spaces and dashes before validating', () => {
    expect(normalizePhone('0812-3456-7890')).toBe('+6281234567890');
  });

  it('rejects anything that is not a plausible Indonesian number', () => {
    expect(normalizePhone('not-a-phone')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+1-555-0100')).toBeNull();
  });
});

describe('generateTemporaryPassword', () => {
  it('produces a password of the requested length from the safe alphabet', () => {
    const pw = generateTemporaryPassword(10);
    expect(pw).toHaveLength(10);
    expect(pw).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]+$/); // excludes 0/O/1/I/l look-alikes
  });

  it('is not the same value twice in a row (randomness sanity check)', () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    expect(a).not.toBe(b);
  });
});
