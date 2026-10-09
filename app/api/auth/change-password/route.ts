import { z } from 'zod';
import { apiOk, handleApiError, apiError } from '@/lib/api-response';
import { requireSession, hashPassword, verifyPassword } from '@/lib/auth';
import { getPasswordHashById, setOwnPassword } from '@/lib/queries/users';
import { passwordSchema } from '@/lib/validators/common';
import { bust, cacheKeys } from '@/lib/redis';

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

// Deliberately uses requireSession(), not requireActiveSession() — this is the one
// route that must keep working while must_change_password is true (TRD.md §11).
export async function POST(request: Request) {
  try {
    const { userId } = await requireSession();
    const body = bodySchema.parse(await request.json());

    const currentHash = await getPasswordHashById(userId);
    if (!currentHash || !(await verifyPassword(body.currentPassword, currentHash))) {
      return apiError(400, 'INVALID_CURRENT_PASSWORD', 'Kata sandi saat ini salah.');
    }

    await setOwnPassword(userId, await hashPassword(body.newPassword));
    // requireSession() caches user:{id}:ctx (incl. mustChangePassword) for 60s — bust it
    // now or the user stays locked out of every other route for up to a minute.
    await bust(cacheKeys.userCtx(userId));
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
