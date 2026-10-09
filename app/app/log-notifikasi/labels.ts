// Display words for the notification log. Same wording as the template editor in
// app/app/settings/notifications so an event reads the same in both places.

import type { NotificationChannel } from '@/lib/constants/statuses';

export const EVENT_LABELS: Record<string, string> = {
  LATE_CHECK_IN: 'Karyawan terlambat',
  MISSING_CHECK_OUT: 'Lupa check-out',
  REQUEST_SUBMITTED: 'Pengajuan baru masuk',
  REQUEST_REVIEWED: 'Pengajuan disetujui/ditolak',
  INVOICE_CREATED: 'Tagihan baru',
  INVOICE_PAID: 'Pembayaran diterima',
};

/** A log row whose template was deleted (template_id is SET NULL) has no event: say so plainly. */
export function eventLabel(eventTrigger: string | null): string {
  return (eventTrigger && EVENT_LABELS[eventTrigger]) || 'Notifikasi';
}

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
};
