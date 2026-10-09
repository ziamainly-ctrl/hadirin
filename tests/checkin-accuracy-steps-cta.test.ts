import { describe, it, expect } from 'vitest';
import { describeAccuracy } from '../components/shared/checkin/accuracy';
import { deriveSteps, type StepsInput } from '../components/shared/checkin/steps';
import { describeCtaState, type CtaInput } from '../components/shared/checkin/cta-state';

describe('describeAccuracy (meter bars follow the product thresholds: 100 m weak, 1 km refused)', () => {
  it('bands', () => {
    expect(describeAccuracy(5)).toMatchObject({ level: 'excellent', bars: 4 });
    expect(describeAccuracy(15)).toMatchObject({ level: 'excellent', bars: 4 });
    expect(describeAccuracy(16)).toMatchObject({ level: 'good', bars: 3 });
    expect(describeAccuracy(40)).toMatchObject({ level: 'good', bars: 3 });
    expect(describeAccuracy(100)).toMatchObject({ level: 'fair', bars: 2 });
    expect(describeAccuracy(101)).toMatchObject({ level: 'weak', bars: 1 });
    expect(describeAccuracy(1000)).toMatchObject({ level: 'weak', bars: 1 });
    expect(describeAccuracy(1001)).toMatchObject({ level: 'poor', bars: 0 });
  });

  it('no reading is poor, not a crash', () => {
    for (const bad of [null, undefined, Number.NaN, -3]) {
      expect(describeAccuracy(bad)).toMatchObject({ level: 'poor', bars: 0 });
    }
  });
});

describe('deriveSteps (Lokasi -> Selfie -> Kirim)', () => {
  const base: StepsInput = { geo: 'ok', blocked: false, inCamera: false, hasPhoto: false, sending: false, done: false, selfieRequired: true };
  const states = (patch: Partial<StepsInput>) => deriveSteps({ ...base, ...patch }).map((s) => `${s.key}:${s.state}`);

  it('looking for the position: location active, the rest waiting', () => {
    expect(states({ geo: 'loading' })).toEqual(['location:active', 'selfie:pending', 'send:pending']);
  });

  it('position found, camera not open yet: the selfie is the next thing to do', () => {
    expect(states({})).toEqual(['location:done', 'selfie:active', 'send:pending']);
  });

  it('a weak fix still counts as a position', () => {
    expect(states({ geo: 'weak' })).toEqual(['location:done', 'selfie:active', 'send:pending']);
  });

  it('camera open, no photo yet', () => {
    expect(states({ inCamera: true })).toEqual(['location:done', 'selfie:active', 'send:pending']);
  });

  it('photo taken: the last step is the person confirming', () => {
    expect(states({ inCamera: true, hasPhoto: true })).toEqual(['location:done', 'selfie:done', 'send:active']);
  });

  it('sending and done', () => {
    expect(states({ inCamera: true, hasPhoto: true, sending: true })).toEqual(['location:done', 'selfie:done', 'send:active']);
    expect(states({ done: true })).toEqual(['location:done', 'selfie:done', 'send:done']);
  });

  it('denied permission or a blocked punch is an error on the first step and holds the rest back', () => {
    expect(states({ geo: 'denied' })).toEqual(['location:error', 'selfie:pending', 'send:pending']);
    expect(states({ geo: 'error' })).toEqual(['location:error', 'selfie:pending', 'send:pending']);
    expect(states({ blocked: true })).toEqual(['location:error', 'selfie:pending', 'send:pending']);
  });

  it('an organisation without selfies has two steps and the button is the last one', () => {
    expect(states({ selfieRequired: false })).toEqual(['location:done', 'send:active']);
    expect(states({ selfieRequired: false, geo: 'loading' })).toEqual(['location:active', 'send:pending']);
  });
});

describe('describeCtaState (every reason the button is off)', () => {
  const ok: CtaInput = { hasFix: true, geoStatus: 'ok', awaitingPrecheck: false, block: null, branchName: 'Kantor Pusat', online: true, busy: false };
  const at = (patch: Partial<CtaInput>) => describeCtaState({ ...ok, ...patch });

  it('ready when everything is fine', () => {
    expect(at({})).toEqual({ enabled: true, code: 'ready', reason: null });
    expect(at({ geoStatus: 'weak-signal' }).enabled).toBe(true);
  });

  it('busy has no caption: the button itself shows the spinner', () => {
    expect(at({ busy: true })).toEqual({ enabled: false, code: 'busy', reason: null });
  });

  it('offline comes before everything but busy', () => {
    expect(at({ online: false, geoStatus: 'denied' }).code).toBe('offline');
    expect(at({ online: false }).reason).toMatch(/koneksi/);
  });

  it('permission and GPS problems', () => {
    expect(at({ geoStatus: 'denied', hasFix: false }).code).toBe('geo-denied');
    expect(at({ geoStatus: 'error', hasFix: false }).code).toBe('geo-error');
    expect(at({ geoStatus: 'loading', hasFix: false }).code).toBe('locating');
  });

  it('a stale fix while refreshing waits for the new one', () => {
    expect(at({ geoStatus: 'loading' }).code).toBe('locating');
  });

  it('names the branch when the person is outside a strict geofence', () => {
    const state = at({ block: 'OUTSIDE_GEOFENCE' });
    expect(state.code).toBe('outside-area');
    expect(state.reason).toContain('Kantor Pusat');
    expect(at({ block: 'OUTSIDE_GEOFENCE', branchName: null }).reason).toMatch(/luar area absen/);
  });

  it('weak accuracy and an unknown block each have a next step', () => {
    expect(at({ block: 'ACCURACY_TOO_LOW' }).code).toBe('accuracy-too-low');
    expect(at({ block: 'SOMETHING_NEW' }).reason).toMatch(/perbarui lokasi/i);
  });

  it('waits for the first pre-check answer', () => {
    expect(at({ awaitingPrecheck: true })).toMatchObject({ enabled: false, code: 'checking-area' });
  });

  it('every reason is Indonesian and says what to do', () => {
    const reasons = [
      at({ online: false }),
      at({ geoStatus: 'denied', hasFix: false }),
      at({ geoStatus: 'error', hasFix: false }),
      at({ geoStatus: 'loading', hasFix: false }),
      at({ block: 'ACCURACY_TOO_LOW' }),
      at({ block: 'OUTSIDE_GEOFENCE' }),
      at({ awaitingPrecheck: true }),
    ].map((s) => s.reason ?? '');
    for (const reason of reasons) {
      expect(reason.length).toBeGreaterThan(10);
      expect(reason).not.toMatch(/\b(the|you|location|offline)\b/i);
    }
  });
});
