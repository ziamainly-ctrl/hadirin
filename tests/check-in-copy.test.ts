import { describe, it, expect } from 'vitest';
import { describeGeoError, describePunchError, WEAK_GPS_HELP_STEPS } from '../lib/check-in-copy';

describe('describePunchError (Indonesian copy, always with a next step)', () => {
  it('OUTSIDE_GEOFENCE reads the distance and radius in human units, not the raw server sentence', () => {
    const copy = describePunchError('check-in', 422, {
      code: 'OUTSIDE_GEOFENCE',
      message: 'You are 116236m from the nearest branch (allowed radius 100m).',
      details: { distanceM: 116236, radiusM: 100, branchName: 'Kantor Pusat' },
    });
    expect(copy.title).toBe('Anda di luar area absen');
    expect(copy.message).toContain('116 km');
    expect(copy.message).toContain('Kantor Pusat');
    expect(copy.message).toContain('100 m');
    expect(copy.message).not.toMatch(/You are|allowed radius/);
    expect(copy.next).toBe('update-location');
  });

  it('OUTSIDE_GEOFENCE without details still says something useful', () => {
    const copy = describePunchError('check-out', 422, { code: 'OUTSIDE_GEOFENCE' });
    expect(copy.message).toContain('di luar area');
    expect(copy.next).toBe('update-location');
  });

  it('a lost connection says so and offers a retry, naming the stage that failed', () => {
    const upload = describePunchError('check-in', undefined, undefined, 'upload');
    const punch = describePunchError('check-in', undefined, undefined, 'punch');
    expect(upload.message).toMatch(/Foto belum terkirim/);
    expect(punch.message).toMatch(/server/);
    expect(upload.next).toBe('retry');
  });

  it('a closed check-out window sends the person to the reloaded page, which carries "Ajukan Koreksi"', () => {
    const copy = describePunchError('check-out', 422, { code: 'CHECKOUT_WINDOW_CLOSED' });
    expect(copy.next).toBe('reload');
    expect(copy.message).toContain('Ajukan Koreksi');
  });

  it('401 and NO_SESSION send the person to login; the password gate to change-password', () => {
    expect(describePunchError('check-in', 401, { code: 'NO_SESSION', message: 'No session' }).next).toBe('login');
    expect(describePunchError('check-in', 401, undefined).next).toBe('login');
    expect(describePunchError('check-in', 403, { code: 'PASSWORD_CHANGE_REQUIRED' }).next).toBe('change-password');
  });

  it('maps every code the punch routes can return to Indonesian copy', () => {
    const codes = [
      'RATE_LIMITED',
      'NOT_TRACKED',
      'NO_BRANCHES',
      'ORG_SUSPENDED',
      'ALREADY_CHECKED_OUT',
      'NOT_CHECKED_IN',
      'CHECKOUT_WINDOW_CLOSED',
      'ALREADY_RECORDED',
      'ACCURACY_TOO_LOW',
      'UNSUPPORTED_MEDIA_TYPE',
      'FILE_TOO_LARGE',
      'INACTIVE',
      'FORBIDDEN',
    ];
    for (const code of codes) {
      const copy = describePunchError('check-in', 422, { code, message: 'English server text' });
      expect(copy.title.length, code).toBeGreaterThan(3);
      expect(copy.message, code).not.toBe('English server text');
      expect(copy.message, code).not.toMatch(/\b(You|Too many|Only JPEG|File exceeds|wrong role)\b/i);
    }
  });

  it('a validation error shows the field message and asks for a fresh location when the position is the problem', () => {
    const copy = describePunchError('check-in', 400, { code: 'VALIDATION_ERROR', fields: { accuracyM: 'Maksimal 1000.' } });
    expect(copy.message).toContain('Maksimal 1000.');
    expect(copy.next).toBe('update-location');
  });

  it('an unknown 5xx and an unknown 4xx fall back to generic Indonesian copy', () => {
    expect(describePunchError('check-out', 500, { code: 'INTERNAL_ERROR', message: 'Boom' }).message).toMatch(/Server/);
    expect(describePunchError('check-out', 418, { code: 'TEAPOT', message: 'Boom' }).message).toMatch(/Terjadi kesalahan/);
  });

  it('titles carry the right verb', () => {
    expect(describePunchError('check-in', 418, {}).title).toBe('Absen masuk belum tercatat');
    expect(describePunchError('check-out', 418, {}).title).toBe('Absen keluar belum tercatat');
  });
});

describe('describeGeoError', () => {
  it('has copy for every browser error with a next step', () => {
    for (const kind of ['denied', 'blocked', 'unavailable', 'timeout', 'unsupported'] as const) {
      const copy = describeGeoError(kind);
      expect(copy.title.length).toBeGreaterThan(5);
      expect(copy.message.length).toBeGreaterThan(20);
    }
    expect(describeGeoError('timeout').title).toBe('Waktu habis mendapatkan lokasi');
  });

  it('weak GPS help has steps', () => {
    expect(WEAK_GPS_HELP_STEPS.length).toBeGreaterThanOrEqual(3);
  });
});
