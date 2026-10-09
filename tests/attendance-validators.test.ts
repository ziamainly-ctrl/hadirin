import { describe, it, expect } from 'vitest';
import '../lib/validators/locale-id';
import {
  checkInSchema,
  checkOutSchema,
  precheckSchema,
  lowAccuracyNote,
  LOW_ACCURACY_NOTE,
  MAX_PUNCH_ACCURACY_M,
} from '../lib/validators/attendance';

const ok = { latitude: -6.2607, longitude: 106.8137, accuracyM: 12 };

describe('punch input schemas', () => {
  it('accepts a normal fix with and without a photo and note', () => {
    expect(checkInSchema.safeParse(ok).success).toBe(true);
    expect(checkOutSchema.safeParse({ ...ok, note: ' lembur ' }).success).toBe(true);
    expect(precheckSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects (0, 0): what a broken or spoofed geolocation reports', () => {
    for (const schema of [checkInSchema, checkOutSchema, precheckSchema]) {
      const r = schema.safeParse({ latitude: 0, longitude: 0, accuracyM: 10 });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.message).toMatch(/Lokasi tidak valid/);
    }
    expect(checkInSchema.safeParse({ latitude: 0, longitude: 106.8, accuracyM: 10 }).success).toBe(true);
  });

  it('rejects out-of-range coordinates and non-positive accuracy', () => {
    expect(checkInSchema.safeParse({ ...ok, latitude: 91 }).success).toBe(false);
    expect(checkInSchema.safeParse({ ...ok, longitude: -181 }).success).toBe(false);
    expect(checkInSchema.safeParse({ ...ok, accuracyM: 0 }).success).toBe(false);
  });

  it('caps the note at the column size (255)', () => {
    expect(checkInSchema.safeParse({ ...ok, note: 'x'.repeat(256) }).success).toBe(false);
    expect(checkInSchema.safeParse({ ...ok, note: 'x'.repeat(255) }).success).toBe(true);
  });

  it('leaves "too inaccurate" to the route (ACCURACY_TOO_LOW) instead of a field error', () => {
    expect(MAX_PUNCH_ACCURACY_M).toBe(1000);
    expect(checkInSchema.safeParse({ ...ok, accuracyM: 5000 }).success).toBe(true);
  });
});

describe('lowAccuracyNote', () => {
  it('flags a weak fix only when the person wrote no note of their own', () => {
    expect(lowAccuracyNote(undefined, 200)).toBe(LOW_ACCURACY_NOTE);
    expect(lowAccuracyNote('  ', 200)).toBe(LOW_ACCURACY_NOTE);
    expect(lowAccuracyNote('Lembur proyek', 200)).toBe('Lembur proyek');
  });

  it('adds nothing for a good fix', () => {
    expect(lowAccuracyNote(undefined, 150)).toBeNull();
    expect(lowAccuracyNote(undefined, 8)).toBeNull();
    expect(lowAccuracyNote('Catatan', 8)).toBe('Catatan');
  });
});
