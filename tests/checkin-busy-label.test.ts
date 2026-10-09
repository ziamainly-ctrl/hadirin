import { describe, it, expect } from 'vitest';
import { describeBusy } from '../components/shared/checkin/busy-label';

describe('describeBusy (the sentence on the dimmed viewfinder)', () => {
  it('says nothing when nothing is being sent', () => {
    expect(describeBusy(null, null, 'Absen masuk')).toBeUndefined();
    expect(describeBusy(null, 0.5, 'Absen masuk')).toBeUndefined();
  });

  it('uploading while bytes are still on their way, or when the browser cannot say how many', () => {
    expect(describeBusy('upload', 0, 'Absen masuk')).toBe('Mengunggah foto...');
    expect(describeBusy('upload', 0.73, 'Absen masuk')).toBe('Mengunggah foto...');
    expect(describeBusy('upload', null, 'Absen masuk')).toBe('Mengunggah foto...');
  });

  it('switches to "Menyimpan" once every byte has been sent (the server is storing the file)', () => {
    expect(describeBusy('upload', 1, 'Absen masuk')).toBe('Menyimpan foto...');
    expect(describeBusy('upload', 1.0000001, 'Absen masuk')).toBe('Menyimpan foto...');
  });

  it('the punch call names the action in lower case', () => {
    expect(describeBusy('punch', null, 'Absen masuk')).toBe('Mencatat absen masuk...');
    expect(describeBusy('punch', 1, 'Absen keluar')).toBe('Mencatat absen keluar...');
  });
});
