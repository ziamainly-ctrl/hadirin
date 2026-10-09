// Turns the raw `notification_logs.error` text into a short Indonesian reason. The raw text is
// whatever the mail library or the WhatsApp gateway threw ("connect ECONNREFUSED 127.0.0.1:587"),
// which is infrastructure detail an organization admin cannot act on and should not read;
// /app/log-notifikasi only ever shows the reason below. Pure, unit-tested.

export interface NotificationFailure {
  /** Short label for the table cell. */
  reason: string;
  /** What the admin can do about it. */
  hint: string;
}

interface Rule {
  test: RegExp;
  failure: NotificationFailure;
}

const RULES: Rule[] = [
  {
    test: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET|EHOSTUNREACH|socket hang up|timed? ?out|network/i,
    failure: {
      reason: 'Layanan pengiriman tidak dapat dihubungi',
      hint: 'Masalah ada di sisi layanan Hadirin, bukan di pengaturan Anda. Pesan tidak dikirim ulang otomatis.',
    },
  },
  {
    test: /not (registered|on) whatsapp|not registered|invalid (number|phone)|no such user|recipient/i,
    failure: {
      reason: 'Nomor penerima tidak valid',
      hint: 'Periksa nomor WhatsApp penerima di halaman Karyawan.',
    },
  },
  {
    test: /mailbox|user unknown|invalid (address|email)|rejected|bounce|550|553|554/i,
    failure: {
      reason: 'Alamat email penerima ditolak',
      hint: 'Periksa alamat email penerima di halaman Karyawan.',
    },
  },
  {
    test: /auth|credential|535|401|403|unauthori[sz]ed|forbidden/i,
    failure: {
      reason: 'Layanan pengiriman menolak akses',
      hint: 'Masalah ada di sisi layanan Hadirin. Hubungi dukungan jika terus berulang.',
    },
  },
];

const FALLBACK: NotificationFailure = {
  reason: 'Pengiriman gagal',
  hint: 'Pesan tidak terkirim. Hubungi dukungan jika terus berulang.',
};

/** `error` null/empty means the log did not record a reason. */
export function describeNotificationFailure(error: string | null | undefined): NotificationFailure {
  if (!error) return FALLBACK;
  for (const rule of RULES) {
    if (rule.test.test(error)) return rule.failure;
  }
  return FALLBACK;
}
