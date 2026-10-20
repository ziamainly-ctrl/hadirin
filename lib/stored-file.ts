import { isOwnAttendancePhoto } from './attendance-photo';
import { isOwnRequestAttachment } from './request-attachment';

// Read-side checks for GET /api/files. The write routes already refuse a photo or attachment
// that is not this person's own upload. A URL already stored on a row is a different door:
// the file route used to fetch whatever string was saved and attach BLOB_READ_WRITE_TOKEN to
// it. That serves another org's file to whoever may see the row, and it would send the token
// to a host that is not our Blob store. Pure and unit-tested.

export type StoredFileSlot = 'check-in' | 'check-out' | 'attachment';

/** True when `url` is exactly the private blob this org and this subject uploaded for this slot. */
export function isStoredFileForSubject(
  url: string,
  orgId: number,
  subjectUserId: number,
  slot: StoredFileSlot,
): boolean {
  if (slot === 'attachment') return isOwnRequestAttachment(url, orgId, subjectUserId);
  return isOwnAttendancePhoto(url, orgId, subjectUserId, slot === 'check-in' ? 'in' : 'out');
}

/**
 * A URL we are willing to attach the Blob token to. https only, our store's host suffix,
 * no userinfo, query, or hash. The path check is `isStoredFileForSubject`; this one stops
 * the token leaving for any other host even if a caller forgets the path check.
 */
export function isTokenSafeBlobUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return false;
  return /\.blob\.vercel-storage\.com$/.test(parsed.hostname);
}

/** The media type we will forward. Anything else (HTML, SVG, a missing header) is dropped. */
export function servedImageContentType(header: string | null): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!header) return null;
  const media = header.split(';')[0]?.trim().toLowerCase();
  if (media === 'image/jpeg' || media === 'image/png' || media === 'image/webp') return media;
  return null;
}
