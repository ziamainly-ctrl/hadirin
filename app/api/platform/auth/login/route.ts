import { z } from 'zod';
import { apiOk, apiError, handleApiError } from '@/lib/api-response';
import { verifyPassword, setSessionCookie } from '@/lib/auth';
import { getPlatformAdminByEmail } from '@/lib/queries/platform-admins';
import { loginRatelimit } from '@/lib/redis';
import { emailSchema } from '@/lib/validators/common';

const bodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

// POST /api/platform/auth/login — separate session kind from the tenant login
// (TRD.md §6/§11): payload.kind='platform', no org. proxy.ts routes /platform/* here.
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { success } = await loginRatelimit.limit(`platform:${ip}:${body.email}`);
    if (!success) return apiError(429, 'RATE_LIMITED', 'Too many login attempts. Try again later.');

    const admin = await getPlatformAdminByEmail(body.email);
    if (!admin || admin.status !== 'ACTIVE' || !(await verifyPassword(body.password, admin.passwordHash))) {
      return apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    await setSessionCookie({ kind: 'platform', sub: admin.id, role: admin.role });

    const { passwordHash, ...safeAdmin } = admin;
    return apiOk({ admin: safeAdmin });
  } catch (error) {
    return handleApiError(error);
  }
}
