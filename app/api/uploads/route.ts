import { z } from 'zod';
import { apiOk, apiError, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { sniffImageType } from '@/lib/image-sniff';
import { uploadRatelimit } from '@/lib/upload-ratelimit';
import {
  MAX_UPLOAD_BYTES,
  attendancePhotoPath,
  requestAttachmentPath,
  extensionForContentType,
  putPrivateFile,
} from '@/lib/blob';

const kindSchema = z.enum(['attendance-check-in', 'attendance-check-out', 'request-attachment']);

// Server-side upload (TRD.md §15) — see lib/blob.ts for why this isn't the
// @vercel/blob/client token flow.
export async function POST(request: Request) {
  try {
    const { userId, orgId } = await requireActiveSession();

    // A suspended organisation cannot punch (the check-in route says so), so it cannot store selfies either.
    const org = await getOrganizationPlanContext(orgId);
    if (org?.status === 'SUSPENDED') {
      return apiError(403, 'ORG_SUSPENDED', 'Langganan organisasi ditangguhkan, jadi unggah foto dinonaktifkan.');
    }
    const { success } = await uploadRatelimit.limit(String(userId));
    if (!success) return apiError(429, 'RATE_LIMITED', 'Terlalu banyak unggahan. Tunggu sebentar lalu coba lagi.');

    const form = await request.formData();
    const file = form.get('file');
    const kind = kindSchema.safeParse(form.get('kind'));
    if (!(file instanceof File)) return apiError(400, 'VALIDATION_ERROR', 'Foto wajib diunggah.');
    if (!kind.success) return apiError(400, 'VALIDATION_ERROR', 'Jenis unggahan tidak valid.');

    if (file.size > MAX_UPLOAD_BYTES) {
      return apiError(400, 'FILE_TOO_LARGE', 'Ukuran foto melebihi 2 MB.');
    }
    // The type is what the bytes are, not what the client called them: a file labelled image/jpeg
    // that is really HTML would otherwise be stored and later served to an admin's browser.
    const contentType = sniffImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
    if (!contentType) {
      return apiError(400, 'UNSUPPORTED_MEDIA_TYPE', 'Foto harus berformat JPEG, PNG, atau WEBP.');
    }

    const ext = extensionForContentType(contentType);
    const path =
      kind.data === 'request-attachment'
        ? requestAttachmentPath(orgId, userId, ext)
        : attendancePhotoPath(orgId, userId, kind.data === 'attendance-check-in' ? 'in' : 'out', ext);

    const { url } = await putPrivateFile(path, file, contentType);

    return apiOk({ url });
  } catch (error) {
    return handleApiError(error);
  }
}
