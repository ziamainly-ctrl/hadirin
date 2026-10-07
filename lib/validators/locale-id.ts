import { z } from 'zod';

type ZodConfig = NonNullable<Parameters<typeof z.config>[0]>;
type RawIssue = Parameters<NonNullable<ZodConfig['localeError']>>[0];

/**
 * Default Zod messages, in short Indonesian. Zod's own `id` locale is a literal translation
 * ("Terlalu kecil: diharapkan string memiliki >=1 karakter"), which reads as a stack trace to
 * a shop owner filling in a form. These are what a person would say: "Wajib diisi.",
 * "Minimal 8 karakter.". They apply only where a schema has no message of its own, because
 * Zod prefers a message written on the schema over the locale's.
 */
export function indonesianIssueMessage(issue: RawIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === null ? 'Wajib diisi.' : 'Format tidak valid.';
    case 'too_small': {
      const min = String(issue.minimum);
      if (issue.origin === 'string') return min === '1' ? 'Wajib diisi.' : `Minimal ${min} karakter.`;
      if (issue.origin === 'array' || issue.origin === 'set') return `Pilih minimal ${min}.`;
      return issue.inclusive === false ? `Harus lebih dari ${min}.` : `Minimal ${min}.`;
    }
    case 'too_big': {
      const max = String(issue.maximum);
      if (issue.origin === 'string') return `Maksimal ${max} karakter.`;
      if (issue.origin === 'array' || issue.origin === 'set') return `Pilih maksimal ${max}.`;
      return issue.inclusive === false ? `Harus kurang dari ${max}.` : `Maksimal ${max}.`;
    }
    case 'invalid_format':
      return issue.format === 'email' ? 'Format email tidak valid.' : 'Format tidak valid.';
    case 'invalid_value':
      return 'Pilihan tidak valid.';
    case 'not_multiple_of':
      return 'Nilai tidak valid.';
    default:
      return 'Isian tidak valid.';
  }
}

z.config({ localeError: indonesianIssueMessage });
