import { z } from 'zod';

// Shared primitives. Length caps match db/schema.ts column sizes (AGENTS.md).

export const idParam = z.coerce.number().int().positive();

export const emailSchema = z.string().trim().toLowerCase().max(150).email();
export const phoneRawSchema = z.string().trim().max(20);
export const nameSchema = z.string().trim().min(1).max(100);
export const passwordSchema = z.string().min(8).max(72);

/** True for a real calendar date: "2026-02-31" has the right shape but is not a day, and Postgres rejects it with a 500. */
export function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan format TTTT-BB-HH.')
  .refine(isRealCalendarDate, 'Tanggal tidak valid.');
// "99:99" matches the shape too and used to reach Postgres, which answers 22007 (a 500).
export const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Gunakan format JJ:MM.')
  .refine((value) => Number(value.slice(0, 2)) < 24 && Number(value.slice(3, 5)) < 60 && Number(value.slice(6, 8) || 0) < 60, 'Jam tidak valid.');

export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** Blob URL must come from our own store (TRD.md §15) — never trust an arbitrary photoUrl. */
export function isOwnBlobUrl(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    return protocol === 'https:' && /\.blob\.vercel-storage\.com$/.test(hostname);
  } catch {
    return false;
  }
}

export const blobUrlSchema = z.string().url().max(500).refine(isOwnBlobUrl, 'Berkas tidak valid.');
