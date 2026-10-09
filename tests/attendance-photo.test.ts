import { describe, it, expect } from 'vitest';
import { isOwnAttendancePhoto } from '../lib/attendance-photo';

// The shape /api/uploads writes (lib/blob.ts attendancePhotoPath + addRandomSuffix), taken from a
// real stored row: attendance/{org}/{utcDate}/{user}-{in|out}-{random}.jpg
const STORE = 'https://mhvythdgw8f6q7bq.private.blob.vercel-storage.com';
const own = `${STORE}/attendance/16/2026-10-07/32-in-GRAUlxyNTiD00Og42Ogbt90ZwAJ6Kg.jpg`;

describe('isOwnAttendancePhoto', () => {
  it('accepts the exact shape for this org, this person and this direction', () => {
    expect(isOwnAttendancePhoto(own, 16, 32, 'in')).toBe(true);
    expect(isOwnAttendancePhoto(own.replace('-in-', '-out-'), 16, 32, 'out')).toBe(true);
    expect(isOwnAttendancePhoto(own.replace('.jpg', '.webp'), 16, 32, 'in')).toBe(true);
  });

  it('rejects another person, another org or the other direction', () => {
    expect(isOwnAttendancePhoto(own, 16, 33, 'in')).toBe(false);
    expect(isOwnAttendancePhoto(own, 17, 32, 'in')).toBe(false);
    expect(isOwnAttendancePhoto(own, 16, 32, 'out')).toBe(false);
  });

  it('does not let a user id match as a prefix of a longer one', () => {
    expect(isOwnAttendancePhoto(own.replace('/32-in-', '/132-in-'), 16, 32, 'in')).toBe(false);
    expect(isOwnAttendancePhoto(own.replace('/16/', '/116/'), 16, 32, 'in')).toBe(false);
  });

  it('rejects a foreign host, plain http, a query string, credentials and other paths', () => {
    expect(isOwnAttendancePhoto('https://evil.example.com/attendance/16/2026-10-07/32-in-abc.jpg', 16, 32, 'in')).toBe(false);
    expect(isOwnAttendancePhoto(own.replace('https:', 'http:'), 16, 32, 'in')).toBe(false);
    expect(isOwnAttendancePhoto(`${own}?download=1`, 16, 32, 'in')).toBe(false);
    expect(isOwnAttendancePhoto(own.replace('https://', 'https://user:pw@'), 16, 32, 'in')).toBe(false);
    expect(isOwnAttendancePhoto(`${STORE}/requests/16/2026-10-07/32-attachment-abc.jpg`, 16, 32, 'in')).toBe(false);
    expect(isOwnAttendancePhoto(own.replace('.jpg', '.html'), 16, 32, 'in')).toBe(false);
    expect(isOwnAttendancePhoto('not a url', 16, 32, 'in')).toBe(false);
    expect(isOwnAttendancePhoto('', 16, 32, 'in')).toBe(false);
  });

  it('rejects a path traversal attempt', () => {
    expect(isOwnAttendancePhoto(`${STORE}/attendance/16/2026-10-07/../../1/2026-10-07/32-in-abc.jpg`, 16, 32, 'in')).toBe(false);
  });
});
