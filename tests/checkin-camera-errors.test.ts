import { describe, it, expect } from 'vitest';
import { classifyCameraError, describeCameraError, type CameraErrorKind } from '../components/shared/checkin/camera-errors';

const named = (name: string) => ({ name });

describe('classifyCameraError (MDN getUserMedia exception names)', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['PermissionDeniedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['DevicesNotFoundError', 'not-found'],
    ['NotReadableError', 'in-use'],
    ['TrackStartError', 'in-use'],
    ['AbortError', 'in-use'],
    ['OverconstrainedError', 'overconstrained'],
    ['TypeError', 'unsupported'],
    ['SomethingElse', 'unknown'],
  ])('%s -> %s', (name, kind) => {
    expect(classifyCameraError(named(name))).toBe(kind);
  });

  it('survives non-errors', () => {
    expect(classifyCameraError(undefined)).toBe('unknown');
    expect(classifyCameraError(null)).toBe('unknown');
    expect(classifyCameraError('boom')).toBe('unknown');
  });
});

describe('describeCameraError', () => {
  const kinds: CameraErrorKind[] = ['denied', 'not-found', 'in-use', 'overconstrained', 'insecure', 'unsupported', 'lost', 'timeout', 'unknown'];

  it('every kind says what happened in Indonesian and carries a next step', () => {
    for (const kind of kinds) {
      const copy = describeCameraError(kind);
      expect(copy.title.length, kind).toBeGreaterThan(5);
      expect(copy.message.length, kind).toBeGreaterThan(20);
      expect(copy.steps.length, kind).toBeGreaterThan(0);
      expect(copy.steps.join(' '), kind).not.toMatch(/\b(permission|denied|camera not)\b/i);
    }
  });

  it('a permission problem points at the site settings and the retry button', () => {
    const copy = describeCameraError('denied');
    expect(copy.steps.join(' ')).toMatch(/gembok|pengaturan situs/i);
    expect(copy.steps.join(' ')).toMatch(/Coba Lagi/);
    expect(copy.retryable).toBe(true);
  });

  it('retrying cannot fix an insecure page or an old browser', () => {
    expect(describeCameraError('insecure').retryable).toBe(false);
    expect(describeCameraError('unsupported').retryable).toBe(false);
    expect(describeCameraError('in-use').retryable).toBe(true);
  });
});
