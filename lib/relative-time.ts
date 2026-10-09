// "3 mnt lalu"-style relative time for the live activity feed (app/app/live). Pure and
// deterministic: the caller passes both instants, so the server render and the client hydration
// of the same feed agree (the page passes the server's own render time as `nowMs`).

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * - under 45 s (or a clock a little ahead of the server): "baru saja"
 * - under 60 min: "N mnt lalu"
 * - under 24 h: "N jam lalu"
 * - 24 to 48 h: "kemarin"
 * - older: a short date such as "5 Okt" in `timeZone`
 */
export function formatRelative(nowMs: number, atMs: number, timeZone = 'Asia/Jakarta'): string {
  const diff = nowMs - atMs;
  if (diff < 45_000) return 'baru saja';
  if (diff < HOUR_MS) return `${Math.max(1, Math.floor(diff / MINUTE_MS))} mnt lalu`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} jam lalu`;
  if (diff < 2 * DAY_MS) return 'kemarin';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone }).format(new Date(atMs));
}
