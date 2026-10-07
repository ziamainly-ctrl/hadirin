import { z } from 'zod';
import { latitudeSchema, longitudeSchema } from './common';

// Shared by POST /api/branches and PATCH /api/branches/[id] (TRD.md §6).

export const upsertBranchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().max(255).optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  // Matches the CHECK constraint in drizzle/0001_custom_constraints.sql.
  radiusM: z.coerce.number().int().min(10).max(5000),
  isActive: z.boolean().optional(),
});
