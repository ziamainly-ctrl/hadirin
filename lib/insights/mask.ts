// Display masking for the notification log (/app/log-notifikasi). The log shows WHO a message
// went to by name; the address or number is shown masked, because the page is a screenshot-friendly
// audit trail and the full contact is already on the employee's own page. Pure, unit-tested.

const FALLBACK = '***';

/** "hendra@kliniksentosa.test" -> "h*****@kliniksentosa.test"; "a@x.id" -> "*@x.id". */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return FALLBACK;
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return FALLBACK;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length === 1) return `*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 1, 5))}@${domain}`;
}

/** "+6281200000001" -> "+6281******001": keeps the first 5 and last 3 characters. */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return FALLBACK;
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 9) return FALLBACK;
  const head = compact.slice(0, 5);
  const tail = compact.slice(-3);
  return `${head}${'*'.repeat(compact.length - 8)}${tail}`;
}

/** Picks the mask by channel; anything unknown or malformed is fully hidden. */
export function maskRecipient(channel: string, value: string | null | undefined): string {
  if (channel === 'EMAIL') return maskEmail(value);
  if (channel === 'WHATSAPP') return maskPhone(value);
  return FALLBACK;
}
