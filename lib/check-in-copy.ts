// Indonesian copy for everything that can go wrong while checking in or out, keyed by the API
// error `code` (never by the English text the server may still send). Each entry says what
// happened AND what to do next (UX rule: an error always carries a next step). Pure, so it is
// shared by the card and unit-tested.

import { formatDistance } from './geo';

export type PunchKind = 'check-in' | 'check-out';

export interface ApiErrorLike {
  code?: string;
  message?: string;
  fields?: Record<string, string>;
  details?: Record<string, unknown>;
}

/** What the screen offers after the error. */
export type PunchErrorNext =
  | 'retry' // go back to the camera / preview and send again
  | 'update-location' // the position is the problem: re-read the GPS
  | 'login' // session ended
  | 'change-password'
  | 'reload' // the screen is out of date: refresh it
  | 'none'; // nothing the person can fix here (ask the admin)

export interface PunchErrorCopy {
  title: string;
  message: string;
  next: PunchErrorNext;
  tone: 'danger' | 'warning';
}

function noun(kind: PunchKind): string {
  return kind === 'check-in' ? 'Absen masuk' : 'Absen keluar';
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param status HTTP status, or undefined when the request never reached the server (offline).
 * @param stage  which request failed; only changes the wording of a network failure.
 */
export function describePunchError(
  kind: PunchKind,
  status: number | undefined,
  error: ApiErrorLike | undefined,
  stage: 'upload' | 'punch' = 'punch',
): PunchErrorCopy {
  const title = `${noun(kind)} belum tercatat`;

  if (status === undefined) {
    return {
      title,
      message:
        stage === 'upload'
          ? 'Foto belum terkirim karena koneksi internet terputus. Periksa sinyal Anda lalu coba lagi.'
          : 'Permintaan belum sampai ke server karena koneksi internet terputus. Periksa sinyal Anda lalu coba lagi.',
      next: 'retry',
      tone: 'danger',
    };
  }

  switch (error?.code) {
    case 'OUTSIDE_GEOFENCE': {
      const distance = num(error.details?.distanceM);
      const radius = num(error.details?.radiusM);
      const branch = typeof error.details?.branchName === 'string' ? error.details.branchName : 'cabang terdekat';
      const where =
        distance !== null && radius !== null
          ? `Anda berada ${formatDistance(distance)} dari ${branch} (batas ${formatDistance(radius)}).`
          : `Anda berada di luar area ${branch}.`;
      return {
        title: 'Anda di luar area absen',
        message: `${where} Dekati lokasi kerja, lalu ketuk Perbarui Lokasi.`,
        next: 'update-location',
        tone: 'warning',
      };
    }
    case 'ACCURACY_TOO_LOW':
      return {
        title: 'Sinyal lokasi terlalu lemah',
        message: 'Akurasi GPS lebih dari 1 km. Pindah ke tempat terbuka, nyalakan lokasi presisi tinggi, lalu ketuk Perbarui Lokasi.',
        next: 'update-location',
        tone: 'warning',
      };
    case 'RATE_LIMITED':
      return {
        title: 'Terlalu banyak percobaan',
        message: 'Tunggu satu menit lalu coba lagi.',
        next: 'retry',
        tone: 'warning',
      };
    case 'NOT_TRACKED':
      return {
        title: 'Akun belum dijadwalkan',
        message: 'Akun Anda belum punya shift, jadi belum bisa absen. Minta admin menetapkan shift, lalu muat ulang halaman ini.',
        next: 'reload',
        tone: 'danger',
      };
    case 'NO_BRANCHES':
      return {
        title: 'Belum ada cabang aktif',
        message: 'Organisasi Anda belum punya cabang aktif sebagai titik absen. Minta admin menambahkan cabang.',
        next: 'reload',
        tone: 'danger',
      };
    case 'ORG_SUSPENDED':
      return {
        title: 'Langganan ditangguhkan',
        message: 'Absen dinonaktifkan sampai tagihan organisasi Anda dibayar. Hubungi pemilik organisasi.',
        next: 'none',
        tone: 'danger',
      };
    case 'ALREADY_CHECKED_OUT':
      return {
        title: 'Anda sudah absen keluar',
        message: 'Absen keluar hari ini sudah tercatat. Muat ulang halaman untuk melihat catatannya.',
        next: 'reload',
        tone: 'warning',
      };
    case 'NOT_CHECKED_IN':
      return {
        title: 'Belum ada absen masuk',
        message: 'Anda belum absen masuk pada hari kerja ini. Muat ulang halaman lalu absen masuk terlebih dahulu.',
        next: 'reload',
        tone: 'warning',
      };
    case 'CHECKOUT_WINDOW_CLOSED':
      return {
        title: 'Batas absen keluar sudah lewat',
        message: 'Absen keluar hanya bisa dilakukan sampai 6 jam setelah jam pulang. Muat ulang halaman, lalu ketuk Ajukan Koreksi agar jam keluar tercatat.',
        // The reloaded page is the "expired" day, which carries the Ajukan Koreksi button.
        next: 'reload',
        tone: 'warning',
      };
    case 'ALREADY_RECORDED':
      return {
        title: 'Hari ini sudah tercatat',
        message: 'Hari ini sudah dicatat sebagai cuti, sakit, izin, libur, atau tidak hadir, jadi tidak perlu absen. Muat ulang halaman untuk melihatnya.',
        next: 'reload',
        tone: 'warning',
      };
    case 'NO_SESSION':
      return {
        title: 'Sesi Anda berakhir',
        message: 'Silakan masuk kembali. Anda akan kembali ke halaman ini setelah masuk.',
        next: 'login',
        tone: 'danger',
      };
    case 'PASSWORD_CHANGE_REQUIRED':
      return {
        title: 'Ganti kata sandi dulu',
        message: 'Akun Anda memakai kata sandi sementara. Ganti kata sandi, lalu absen.',
        next: 'change-password',
        tone: 'warning',
      };
    case 'INACTIVE':
    case 'SUSPENDED':
      return {
        title: 'Akun tidak aktif',
        message: 'Akun Anda dinonaktifkan, jadi tidak bisa absen. Hubungi admin perusahaan Anda.',
        next: 'none',
        tone: 'danger',
      };
    case 'FORBIDDEN':
      return {
        title,
        message: 'Akun Anda tidak diizinkan melakukan tindakan ini. Hubungi admin perusahaan Anda.',
        next: 'none',
        tone: 'danger',
      };
    case 'UNSUPPORTED_MEDIA_TYPE':
      return {
        title: 'Format foto tidak didukung',
        message: 'Foto harus berformat JPEG, PNG, atau WEBP. Ambil ulang fotonya.',
        next: 'retry',
        tone: 'warning',
      };
    case 'FILE_TOO_LARGE':
      return {
        title: 'Foto terlalu besar',
        message: 'Ukuran foto melebihi 2 MB. Ambil ulang foto dengan resolusi lebih kecil.',
        next: 'retry',
        tone: 'warning',
      };
    case 'VALIDATION_ERROR': {
      const field = error.fields ? Object.values(error.fields)[0] : undefined;
      return {
        title,
        message: field ? `${field} Periksa lalu coba lagi.` : 'Data yang dikirim tidak valid. Perbarui lokasi lalu coba lagi.',
        next: error.fields?.latitude || error.fields?.longitude || error.fields?.accuracyM ? 'update-location' : 'retry',
        tone: 'warning',
      };
    }
    default:
      break;
  }

  if (status === 401) {
    return describePunchError(kind, status, { code: 'NO_SESSION' }, stage);
  }
  if (status === 429) {
    return describePunchError(kind, status, { code: 'RATE_LIMITED' }, stage);
  }
  if (status >= 500) {
    return {
      title,
      message: 'Server sedang bermasalah. Tunggu sebentar lalu coba lagi. Jika terus berulang, hubungi admin.',
      next: 'retry',
      tone: 'danger',
    };
  }
  return {
    title,
    message: 'Terjadi kesalahan saat mencatat absensi. Coba lagi, atau muat ulang halaman.',
    next: 'retry',
    tone: 'danger',
  };
}

/** Copy for the geolocation errors a browser can raise. */
export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'blocked';

export function describeGeoError(kind: GeoErrorKind): { title: string; message: string } {
  switch (kind) {
    case 'denied':
    case 'blocked':
      return {
        title: 'Izin lokasi ditolak',
        message:
          'Lokasi dibutuhkan untuk mencatat absensi. Buka pengaturan situs di browser (ikon gembok di kolom alamat), izinkan Lokasi, lalu ketuk Coba Lagi.',
      };
    case 'timeout':
      return {
        title: 'Waktu habis mendapatkan lokasi',
        message: 'Sinyal GPS belum didapat. Pindah ke tempat terbuka atau dekat jendela, lalu ketuk Coba Lagi.',
      };
    case 'unsupported':
      return {
        title: 'Browser tidak mendukung lokasi',
        message: 'Buka halaman ini di Chrome, Safari, atau Firefox versi terbaru pada ponsel Anda.',
      };
    default:
      return {
        title: 'Lokasi belum terdeteksi',
        message: 'Pastikan GPS atau layanan lokasi di perangkat Anda aktif, lalu ketuk Coba Lagi.',
      };
  }
}

/** Steps shown under the weak-GPS warning ("Bantuan lokasi"). */
export const WEAK_GPS_HELP_STEPS: readonly string[] = [
  'Nyalakan Lokasi atau GPS di ponsel dan pilih mode akurasi tinggi.',
  'Pindah ke tempat terbuka atau dekat jendela, jauh dari ruangan tertutup.',
  'Matikan VPN dan aplikasi lokasi palsu.',
  'Ketuk Perbarui Lokasi dan tunggu sampai akurasi di bawah 100 m.',
];
