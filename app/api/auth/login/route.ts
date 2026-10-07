import { z } from 'zod';
import { apiOk, handleApiError, apiError } from '@/lib/api-response';
import { verifyPassword, setSessionCookie, normalizePhone } from '@/lib/auth';
import { getUserByLoginIdentifier, touchLastLogin } from '@/lib/queries/users';
import { loginRatelimit } from '@/lib/redis';

const bodySchema = z.object({
  identifier: z.string().trim().min(3).max(150),
  password: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { success } = await loginRatelimit.limit(`${ip}:${body.identifier.toLowerCase()}`);
    if (!success) return apiError(429, 'RATE_LIMITED', 'Too many login attempts. Try again later.');

    const identifier = body.identifier.includes('@') ? body.identifier.toLowerCase() : normalizePhone(body.identifier);
    if (!identifier) return apiError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password.');

    const user = await getUserByLoginIdentifier(identifier);
    if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(body.password, user.passwordHash))) {
      return apiError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password.');
    }

    await setSessionCookie({ kind: 'user', sub: user.id, org: user.orgId, role: user.role });
    await touchLastLogin(user.id);

    const { passwordHash, ...safeUser } = user;
    return apiOk({ user: safeUser });
  } catch (error) {
    return handleApiError(error);
  }
}
