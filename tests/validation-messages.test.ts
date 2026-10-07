import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import '../lib/validators/locale-id';

function firstMessage(schema: z.ZodType, input: unknown): string {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('expected a validation failure');
  return result.error.issues[0]?.message ?? '';
}

describe('Indonesian default validation messages', () => {
  it('says "Wajib diisi." for an empty required string and for a missing value', () => {
    expect(firstMessage(z.string().min(1), '')).toBe('Wajib diisi.');
    expect(firstMessage(z.object({ name: z.string() }), {})).toBe('Wajib diisi.');
  });

  it('states length limits in characters', () => {
    expect(firstMessage(z.string().min(8), 'abc')).toBe('Minimal 8 karakter.');
    expect(firstMessage(z.string().max(5), 'abcdefg')).toBe('Maksimal 5 karakter.');
  });

  it('states numeric limits without the word "karakter"', () => {
    expect(firstMessage(z.number().min(1), 0)).toBe('Minimal 1.');
    expect(firstMessage(z.number().max(100), 101)).toBe('Maksimal 100.');
  });

  it('distinguishes email format from other formats', () => {
    expect(firstMessage(z.string().email(), 'nope')).toBe('Format email tidak valid.');
    expect(firstMessage(z.string().regex(/^\d+$/), 'abc')).toBe('Format tidak valid.');
  });

  it('keeps a message written on the schema instead of overriding it', () => {
    expect(firstMessage(z.string().min(1, 'Nama wajib diisi'), '')).toBe('Nama wajib diisi');
  });
});
