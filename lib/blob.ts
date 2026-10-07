import 'server-only';
import { put } from '@vercel/blob';

// @vercel/blob@2.8.1's client-token upload flow (handleUpload) cannot mint a private
// token (vercel/storage#1079 — onBeforeGenerateToken has no `access` field, so client
// uploads are forced to `public`). TRD.md §15 requires private storage for selfies and
// attachments, so every upload goes through this server-side helper instead.

export const ALLOWED_UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export async function putPrivateFile(pathname: string, body: Blob, contentType: string): Promise<{ url: string }> {
  const blob = await put(pathname, body, {
    access: 'private',
    addRandomSuffix: true,
    contentType,
  });
  return { url: blob.url };
}

/** Our server always mediates reads — no signed/presigned URLs needed (TRD.md §15). */
export async function fetchPrivateBlob(url: string): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set. See .env.example.');
  }
  return fetch(url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
}

/** `attendance/{orgId}/{dateSeg}/{userId}-{in|out}.jpg` (TRD.md §7). `dateSeg` is just a
 * human-readable folder (today's UTC date) — business-logic work dates are computed and
 * stored in attendance_logs.work_date independently, never derived from this path. */
export function attendancePhotoPath(orgId: number, userId: number, direction: 'in' | 'out', ext: string): string {
  const dateSeg = new Date().toISOString().slice(0, 10);
  return `attendance/${orgId}/${dateSeg}/${userId}-${direction}.${ext}`;
}

export function requestAttachmentPath(orgId: number, userId: number, ext: string): string {
  const dateSeg = new Date().toISOString().slice(0, 10);
  return `requests/${orgId}/${dateSeg}/${userId}-attachment.${ext}`;
}

export function extensionForContentType(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}
