import { z } from 'zod';
import { nameSchema, emailSchema, phoneRawSchema, idParam, dateStringSchema, passwordSchema } from './common';
import { USER_ROLES } from '../constants/roles';
import { USER_STATUSES } from '../constants/statuses';

// Base fields shared by create and update. Kept as a plain shape object (not a
// ZodObject already wrapped in .refine()) so updateUserSchema can call .partial()
// on it — zod drops .partial() once a schema is wrapped in a refine/effect.
const userFields = {
  name: nameSchema,
  role: z.enum(USER_ROLES),
  email: emailSchema.nullable().optional(),
  phone: phoneRawSchema.nullable().optional(),
  branchId: idParam.nullable().optional(),
  shiftId: idParam.nullable().optional(),
  managerId: idParam.nullable().optional(),
  employeeCode: z.string().trim().max(30).nullable().optional(),
  position: z.string().trim().max(80).nullable().optional(),
  joinedAt: dateStringSchema.nullable().optional(),
};

// GET /api/users query filters. `managerId` is deliberately not accepted here — the
// route computes it server-side from the caller's role/session (AGENTS.md domain rule #1).
export const listUsersQuerySchema = z.object({
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(USER_ROLES).optional(),
  branchId: idParam.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

// POST /api/users. Mirrors the ck_users_login_id CHECK: at least one of email/phone.
export const createUserSchema = z.object(userFields).refine((data) => Boolean(data.email) || Boolean(data.phone), {
  message: 'Either email or phone is required',
  path: ['email'],
});

// PATCH /api/users/[id]. Same shape, all optional, plus status.
export const updateUserSchema = z.object(userFields).partial().extend({
  status: z.enum(USER_STATUSES).optional(),
});

// POST /api/auth/change-password. Self-service; distinct from resetPasswordSchema.
export const changePasswordSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});

// POST /api/users/[id]/reset-password. Admin-triggered, :id in the URL, no body.
export const resetPasswordSchema = z.object({});
