import { describe, it, expect } from 'vitest';
import { isStoredFileForSubject, isTokenSafeBlobUrl, servedImageContentType } from '../lib/stored-file';

const STORE = 'https://mhvythdgw8f6q7bq.private.blob.vercel-storage.com';
const selfie = `${STORE}/attendance/16/2026-10-07/32-in-GRAUlxyNTiD00Og42Ogbt90ZwAJ6Kg.jpg`;
const attachment = `${STORE}/requests/16/2026-10-07/32-attachment-GRAUlxyNTiD00Og42Ogbt90ZwAJ6Kg.jpg`;

describe('isStoredFileForSubject', () => {
  it("accepts the subject's own selfie or attachment for the matching slot", () => {
    expect(isStoredFileForSubject(selfie, 16, 32, 'check-in')).toBe(true);
    expect(isStoredFileForSubject(selfie.replace('-in-', '-out-'), 16, 32, 'check-out')).toBe(true);
    expect(isStoredFileForSubject(attachment, 16, 32, 'attachment')).toBe(true);
  });

  it('rejects a url that belongs to another person, another org, or the other slot', () => {
    expect(isStoredFileForSubject(selfie, 16, 33, 'check-in')).toBe(false);
    expect(isStoredFileForSubject(selfie, 17, 32, 'check-in')).toBe(false);
    expect(isStoredFileForSubject(selfie, 16, 32, 'check-out')).toBe(false);
    expect(isStoredFileForSubject(attachment, 16, 32, 'check-in')).toBe(false);
    expect(isStoredFileForSubject(selfie, 16, 32, 'attachment')).toBe(false);
  });
});

describe('isTokenSafeBlobUrl', () => {
  it('accepts a plain https url on the blob host', () => {
    expect(isTokenSafeBlobUrl(selfie)).toBe(true);
  });

  it('rejects a foreign host, userinfo, a query, a hash, and plain http', () => {
    expect(isTokenSafeBlobUrl('https://evil.example.com/attendance/16/2026-10-07/32-in-abc.jpg')).toBe(false);
    expect(isTokenSafeBlobUrl(selfie.replace('https://', 'https://user:pw@'))).toBe(false);
    expect(isTokenSafeBlobUrl(`${selfie}?x=1`)).toBe(false);
    expect(isTokenSafeBlobUrl(`${selfie}#frag`)).toBe(false);
    expect(isTokenSafeBlobUrl(selfie.replace('https:', 'http:'))).toBe(false);
    expect(isTokenSafeBlobUrl('not a url')).toBe(false);
  });
});

describe('servedImageContentType', () => {
  it('keeps a jpeg, png, or webp type and drops parameters', () => {
    expect(servedImageContentType('image/jpeg')).toBe('image/jpeg');
    expect(servedImageContentType('image/png; charset=binary')).toBe('image/png');
    expect(servedImageContentType('IMAGE/WEBP')).toBe('image/webp');
  });

  it('drops html and a missing type so they are not streamed to the browser', () => {
    expect(servedImageContentType('text/html')).toBeNull();
    expect(servedImageContentType('image/svg+xml')).toBeNull();
    expect(servedImageContentType(null)).toBeNull();
    expect(servedImageContentType('')).toBeNull();
  });
});
