import { apiOk, handleApiError } from '@/lib/api-response';
import { AuthError, requireActiveSession, hashPassword, generateTemporaryPassword } from '@/lib/auth';
import { idParam } from '@/lib/validators/common';
import { resetPasswordSchema } from '@/lib/validators/users';
import { getUserByIdInOrg, setTemporaryPasswordInOrg } from '@/lib/queries/users';
import { canResetPassword } from '@/lib/user-guards';
import { cacheKeys, bust } from '@/lib/redis';

// POST /api/users/[id]/reset-password — admin-triggered, OWNER/ADMIN only. Body is
// always {} (resetPasswordSchema), parsed anyway for consistency with the other POSTs
// and to reject a malformed non-JSON body cleanly.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId, userId, role } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);
    resetPasswordSchema.parse(await request.json());

    // A reset returns a working password, so resetting the owner's is taking over the owner's account.
    const target = await getUserByIdInOrg(orgId, id);
    if (!canResetPassword(role, userId, target)) {
      throw new AuthError('FORBIDDEN', 'Hanya pemilik yang dapat mengatur ulang kata sandi pemilik.');
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    await setTemporaryPasswordInOrg(orgId, id, passwordHash);
    // Clears the cached must_change_password flag too (TRD.md §10).
    await bust(cacheKeys.userCtx(id));

    // Same one-time-reveal contract as POST /api/users.
    return apiOk({ temporaryPassword: tempPassword });
  } catch (error) {
    return handleApiError(error);
  }
}
