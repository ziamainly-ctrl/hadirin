// Everything that can stop a camera from opening, with Indonesian copy that says what happened AND
// what to do next (the same rule lib/check-in-copy.ts follows for punch errors). Pure, unit tested
// (tests/checkin-camera-errors.test.ts). Error names are from MDN's getUserMedia() page.

export type CameraErrorKind =
  | 'denied' // NotAllowedError / SecurityError: the person (or a policy) said no
  | 'not-found' // NotFoundError: no camera at all
  | 'in-use' // NotReadableError / AbortError: another app holds the camera
  | 'overconstrained' // OverconstrainedError: our constraints were too tight (the caller retries loosely)
  | 'insecure' // no navigator.mediaDevices because the page is not https
  | 'unsupported' // an old browser without getUserMedia
  | 'lost' // the stream ended while open (unplugged, permission revoked, tab slept)
  | 'timeout' // the permission prompt was ignored
  | 'unknown';

export function classifyCameraError(error: unknown): CameraErrorKind {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'not-found';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'in-use';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'overconstrained';
    case 'TypeError':
      return 'unsupported';
    default:
      return 'unknown';
  }
}

export interface CameraErrorCopy {
  title: string;
  message: string;
  /** Numbered recovery steps, short enough for a phone. Empty when there is nothing to try. */
  steps: readonly string[];
  /** Whether "Coba Lagi" can help (a missing camera or an insecure page cannot be fixed by retrying). */
  retryable: boolean;
}

export function describeCameraError(kind: CameraErrorKind): CameraErrorCopy {
  switch (kind) {
    case 'denied':
      return {
        title: 'Izin kamera ditolak',
        message: 'Browser tidak diizinkan memakai kamera, jadi selfie belum bisa diambil.',
        steps: [
          'Ketuk ikon gembok atau pengaturan situs di dekat alamat web.',
          'Ubah izin Kamera menjadi Izinkan.',
          'Kembali ke sini lalu ketuk Coba Lagi.',
        ],
        retryable: true,
      };
    case 'not-found':
      return {
        title: 'Kamera tidak ditemukan',
        message: 'Perangkat ini tidak punya kamera yang bisa dipakai browser.',
        steps: ['Sambungkan kamera atau buka halaman ini di ponsel.', 'Atau pilih foto selfie dari perangkat.'],
        retryable: true,
      };
    case 'in-use':
      return {
        title: 'Kamera sedang dipakai',
        message: 'Aplikasi atau tab lain sedang memakai kamera, jadi browser tidak bisa membukanya.',
        steps: ['Tutup aplikasi lain yang memakai kamera (video call, perekam).', 'Ketuk Coba Lagi.'],
        retryable: true,
      };
    case 'overconstrained':
      return {
        title: 'Kamera tidak cocok',
        message: 'Kamera perangkat ini tidak mendukung pengaturan yang diminta.',
        steps: ['Ketuk Coba Lagi.', 'Jika tetap gagal, pilih foto selfie dari perangkat.'],
        retryable: true,
      };
    case 'insecure':
      return {
        title: 'Kamera butuh koneksi aman',
        message: 'Browser hanya mengizinkan kamera di halaman https.',
        steps: ['Buka alamat situs ini dengan https://.', 'Atau pilih foto selfie dari perangkat.'],
        retryable: false,
      };
    case 'unsupported':
      return {
        title: 'Browser belum mendukung kamera',
        message: 'Browser ini tidak bisa membuka kamera langsung dari halaman.',
        steps: ['Buka halaman ini di Chrome, Safari, atau Firefox terbaru.', 'Atau pilih foto selfie dari perangkat.'],
        retryable: false,
      };
    case 'lost':
      return {
        title: 'Kamera terputus',
        message: 'Kamera berhenti di tengah jalan. Biasanya karena aplikasi lain mengambil alih atau izin dicabut.',
        steps: ['Pastikan kamera tidak dipakai aplikasi lain.', 'Ketuk Coba Lagi.'],
        retryable: true,
      };
    case 'timeout':
      return {
        title: 'Menunggu izin kamera',
        message: 'Browser menunggu jawaban Anda di jendela izin kamera.',
        steps: ['Cari jendela izin di bagian atas layar.', 'Ketuk Izinkan, atau Coba Lagi untuk memunculkannya lagi.'],
        retryable: true,
      };
    default:
      return {
        title: 'Kamera belum bisa dibuka',
        message: 'Ada masalah yang tidak dikenali saat membuka kamera.',
        steps: ['Ketuk Coba Lagi.', 'Jika tetap gagal, pilih foto selfie dari perangkat.'],
        retryable: true,
      };
  }
}
