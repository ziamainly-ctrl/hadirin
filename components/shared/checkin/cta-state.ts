// Why is the main button off? A disabled control with no explanation is the worst state of a
// check-in screen (the person is standing at the office door, late), so every reason that turns the
// button off is named here, in priority order, with the next step. Pure: tests/checkin-cta-state.test.ts.

export type CtaCode =
  | 'busy'
  | 'offline'
  | 'geo-denied'
  | 'geo-error'
  | 'locating'
  | 'accuracy-too-low'
  | 'outside-area'
  | 'checking-area'
  | 'ready';

export interface CtaInput {
  /** There is a position (a fix, even a weak one). */
  hasFix: boolean;
  geoStatus: 'loading' | 'ok' | 'weak-signal' | 'denied' | 'error';
  /** The first pre-check answer has not arrived yet. */
  awaitingPrecheck: boolean;
  /** The pre-check's refusal reason, null when the punch is allowed. */
  block: string | null;
  branchName: string | null;
  online: boolean;
  /** An upload / punch is in flight. */
  busy: boolean;
}

export interface CtaState {
  enabled: boolean;
  code: CtaCode;
  /** Shown under the disabled button; null when enabled or when the button itself says it (busy). */
  reason: string | null;
}

export function describeCtaState(input: CtaInput): CtaState {
  if (input.busy) return { enabled: false, code: 'busy', reason: null };
  if (!input.online) {
    return { enabled: false, code: 'offline', reason: 'Tidak ada koneksi internet. Tombol aktif lagi saat Anda online.' };
  }
  if (input.geoStatus === 'denied') {
    return { enabled: false, code: 'geo-denied', reason: 'Izin lokasi ditolak. Izinkan lokasi di pengaturan browser, lalu ketuk Coba Lagi.' };
  }
  if (input.geoStatus === 'error') {
    return { enabled: false, code: 'geo-error', reason: 'Lokasi belum terdeteksi. Aktifkan GPS lalu ketuk Coba Lagi.' };
  }
  if (!input.hasFix || input.geoStatus === 'loading') {
    return { enabled: false, code: 'locating', reason: 'Mencari lokasi Anda. Tombol aktif setelah lokasi ditemukan.' };
  }
  if (input.block === 'ACCURACY_TOO_LOW') {
    return { enabled: false, code: 'accuracy-too-low', reason: 'Sinyal GPS terlalu lemah. Pindah ke tempat terbuka lalu perbarui lokasi.' };
  }
  if (input.block === 'OUTSIDE_GEOFENCE') {
    return {
      enabled: false,
      code: 'outside-area',
      reason: `Anda di luar area ${input.branchName ?? 'absen'}. Dekati lokasi kerja lalu perbarui lokasi.`,
    };
  }
  if (input.block) {
    return { enabled: false, code: 'outside-area', reason: 'Absen belum bisa dilakukan dari sini. Perbarui lokasi lalu coba lagi.' };
  }
  if (input.awaitingPrecheck) {
    return { enabled: false, code: 'checking-area', reason: 'Memeriksa area absen...' };
  }
  return { enabled: true, code: 'ready', reason: null };
}
