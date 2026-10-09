// A request-attachment URL a POST /api/attendance-requests body may reference. /api/uploads
// writes requests/{orgId}/{utcDate}/{userId}-attachment-{random}.{jpg|png|webp} into our own
// private Blob store (lib/blob.ts requestAttachmentPath). createRequestSchema's blobUrlSchema
// only checks the host (any Vercel Blob store, any path), so without this a request could name
// ANY private file in the store — another user's selfie, another org's attachment — and whoever
// is allowed to review *this* request (its own manager/org admin) would then be served that
// stranger's file through GET /api/files/attendance-requests/[id]/attachment, which only checks
// who may see *this request row*, not whose blob the URL actually points at. The route must
// accept only a URL of exactly this shape for THIS org and THIS person. Pure and unit-tested;
// the host check is the same as common.ts's isOwnBlobUrl and attendance-photo.ts's sibling check.
export function isOwnRequestAttachment(url: string, orgId: number, userId: number): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || !/\.blob\.vercel-storage\.com$/.test(parsed.hostname)) return false;
  if (parsed.search || parsed.hash || parsed.username || parsed.password) return false;
  const expected = new RegExp(`^/requests/${orgId}/\\d{4}-\\d{2}-\\d{2}/${userId}-attachment-[A-Za-z0-9_-]+\\.(jpg|png|webp)$`);
  return expected.test(parsed.pathname);
}
