import { z } from 'zod';
import { apiOk, apiError, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
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

    const form = await request.formData();
    const file = form.get('file');
    const kind = kindSchema.safeParse(form.get('kind'));
    if (!(file instanceof File)) return apiError(400, 'VALIDATION_ERROR', 'Missing file.');
    if (!kind.success) return apiError(400, 'VALIDATION_ERROR', 'Missing or invalid kind.');

    if (!ALLOWED_UPLOAD_CONTENT_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number])) {
      return apiError(400, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG or WEBP images are accepted.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return apiError(400, 'FILE_TOO_LARGE', 'File exceeds the 2 MB limit.');
    }

    const ext = extensionForContentType(file.type);
    const path =
      kind.data === 'request-attachment'
        ? requestAttachmentPath(orgId, userId, ext)
        : attendancePhotoPath(orgId, userId, kind.data === 'attendance-check-in' ? 'in' : 'out', ext);

    const { url } = await putPrivateFile(path, file, file.type);

    return apiOk({ url });
  } catch (error) {
    return handleApiError(error);
  }
}
