import { describe, it, expect } from 'vitest';
import { isOwnRequestAttachment } from '../lib/request-attachment';

// The shape /api/uploads writes (lib/blob.ts requestAttachmentPath + addRandomSuffix), same
// fixture style as tests/attendance-photo.test.ts.
const STORE = 'https://mhvythdgw8f6q7bq.private.blob.vercel-storage.com';
const own = `${STORE}/requests/16/2026-10-07/32-attachment-GRAUlxyNTiD00Og42Ogbt90ZwAJ6Kg.jpg`;

describe('isOwnRequestAttachment', () => {
  it('accepts the exact shape for this org and this person', () => {
    expect(isOwnRequestAttachment(own, 16, 32)).toBe(true);
    expect(isOwnRequestAttachment(own.replace('.jpg', '.png'), 16, 32)).toBe(true);
    expect(isOwnRequestAttachment(own.replace('.jpg', '.webp'), 16, 32)).toBe(true);
  });

  it('rejects another person or another org', () => {
    expect(isOwnRequestAttachment(own, 16, 33)).toBe(false);
    expect(isOwnRequestAttachment(own, 17, 32)).toBe(false);
  });

  it('rejects a different resource (e.g. an attendance selfie) reused as an attachment', () => {
    expect(isOwnRequestAttachment(`${STORE}/attendance/16/2026-10-07/32-in-GRAUlxyNTiD00Og42Ogbt90ZwAJ6Kg.jpg`, 16, 32)).toBe(false);
  });

  it('rejects a path with query/hash/credentials, or a host outside our store', () => {
    expect(isOwnRequestAttachment(`${own}?x=1`, 16, 32)).toBe(false);
    expect(isOwnRequestAttachment(`${own}#frag`, 16, 32)).toBe(false);
    expect(isOwnRequestAttachment(own.replace(STORE, 'https://evil.example.com'), 16, 32)).toBe(false);
  });

  it('rejects a malformed URL', () => {
    expect(isOwnRequestAttachment('not a url', 16, 32)).toBe(false);
  });
});
