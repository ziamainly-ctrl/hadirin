import { apiOk, handleApiError } from '@/lib/api-response';
import { requireActiveSession, hashPassword, generateTemporaryPassword } from '@/lib/auth';
import { idParam } from '@/lib/validators/common';
import { resetPasswordSchema } from '@/lib/validators/users';
import { setTemporaryPasswordInOrg } from '@/lib/queries/users';
import { cacheKeys, bust } from '@/lib/redis';

// POST /api/users/[id]/reset-password — admin-triggered, OWNER/ADMIN only. Body is
// always {} (resetPasswordSchema), parsed anyway for consistency with the other POSTs
// and to reject a malformed non-JSON body cleanly.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);
    const id = idParam.parse((await params).id);
    resetPasswordSchema.parse(await request.json());

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
