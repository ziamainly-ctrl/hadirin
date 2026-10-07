import { apiOk, handleApiError } from '@/lib/api-response';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  try {
    await clearSessionCookie();
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
