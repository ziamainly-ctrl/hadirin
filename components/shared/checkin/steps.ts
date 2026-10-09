// The Lokasi -> Selfie -> Kirim indicator at the top of the check-in screen. Pure: the card feeds
// it what it already knows and gets back one state per step (tests/checkin-steps.test.ts).

export type StepKey = 'location' | 'selfie' | 'send';
export type StepState = 'done' | 'active' | 'pending' | 'error';

export interface StepView {
  key: StepKey;
  label: string;
  state: StepState;
}

export type StepGeo = 'loading' | 'ok' | 'weak' | 'denied' | 'error';

export interface StepsInput {
  geo: StepGeo;
  /** The server's pre-check refuses a punch from here (outside a STRICT geofence, accuracy > 1 km). */
  blocked: boolean;
  /** The camera is open (or the person is reviewing a photo). */
  inCamera: boolean;
  /** A photo has been taken and is waiting for "Kirim". */
  hasPhoto: boolean;
  /** The photo / punch request is in flight. */
  sending: boolean;
  /** The punch was recorded. */
  done: boolean;
  /** An organisation can switch the selfie off: then there are only two steps. */
  selfieRequired: boolean;
}

export function deriveSteps(input: StepsInput): StepView[] {
  const { geo, blocked, inCamera, hasPhoto, sending, done, selfieRequired } = input;

  const locationState: StepState = done
    ? 'done'
    : geo === 'denied' || geo === 'error' || blocked
      ? 'error'
      : geo === 'loading'
        ? 'active'
        : 'done';
  const locationDone = locationState === 'done';

  const selfieState: StepState = done || hasPhoto || sending
    ? 'done'
    : !locationDone
      ? 'pending'
      : 'active';

  const sendState: StepState = done
    ? 'done'
    : sending || hasPhoto
      ? 'active'
      : !selfieRequired && locationDone && !inCamera
        ? 'active'
        : 'pending';

  const steps: StepView[] = [{ key: 'location', label: 'Lokasi', state: locationState }];
  if (selfieRequired) steps.push({ key: 'selfie', label: 'Selfie', state: selfieState });
  steps.push({ key: 'send', label: 'Kirim', state: sendState });
  return steps;
}
