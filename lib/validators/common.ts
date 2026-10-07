import { z } from 'zod';

// Shared primitives. Length caps match db/schema.ts column sizes (AGENTS.md).

export const idParam = z.coerce.number().int().positive();

export const emailSchema = z.string().trim().toLowerCase().max(150).email();
export const phoneRawSchema = z.string().trim().max(20);
export const nameSchema = z.string().trim().min(1).max(100);
export const passwordSchema = z.string().min(8).max(72);

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const timeStringSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Expected HH:MM');

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

export const blobUrlSchema = z.string().url().max(500).refine(isOwnBlobUrl, 'Must be a Vercel Blob URL');
