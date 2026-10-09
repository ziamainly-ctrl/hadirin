// A selfie URL a punch may reference. /api/uploads writes
//   attendance/{orgId}/{utcDate}/{userId}-{in|out}-{random}.{jpg|png|webp}
// into our own private Blob store (lib/blob.ts). The punch routes accept only a URL of exactly
// that shape for THIS org, THIS person and THIS direction, so nobody can attach another person's
// selfie (a manager can read the raw URLs of the team in GET /api/attendance) or a selfie of the
// wrong kind. Pure and unit-tested; the host check is the same as common.ts's isOwnBlobUrl.

export function isOwnAttendancePhoto(
  url: string,
  orgId: number,
  userId: number,
  direction: 'in' | 'out',
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || !/\.blob\.vercel-storage\.com$/.test(parsed.hostname)) return false;
  if (parsed.search || parsed.hash || parsed.username || parsed.password) return false;
  const expected = new RegExp(
    `^/attendance/${orgId}/\\d{4}-\\d{2}-\\d{2}/${userId}-${direction}-[A-Za-z0-9_-]+\\.(jpg|png|webp)$`,
  );
  return expected.test(parsed.pathname);
}
