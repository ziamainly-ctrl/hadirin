// Display helpers shared by the attendance table, the approval inbox and the monthly report
// (all under app/app/), so the same value never reads two ways on two admin pages.

// Minute counts (attendance_logs.late_minutes / work_minutes and their monthly sums) as
// short Indonesian durations: 18 → "18 mnt", 482 → "8 jam 2 mnt", 480 → "8 jam".
// Hours go through id-ID grouping so a large monthly total reads "1.234 jam".
const INTEGER_FORMATTER = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursLabel = `${INTEGER_FORMATTER.format(hours)} jam`;
  return rest === 0 ? hoursLabel : `${hoursLabel} ${rest} mnt`;
}

/**
 * A Postgres DATE column as its "YYYY-MM-DD" calendar date. The Neon driver hands DATE
 * values back as a JS Date at *server-local* midnight (pg-types' default), even though the
 * row types say `string` — so on a server running in Asia/Jakarta, 7 Okt arrives as
 * 2026-10-06T17:00Z and a UTC formatter printed "6 Okt". Reading the local calendar parts
 * undoes exactly what the parser did, on any server timezone; a real string passes through.
 * Server-only by nature: call it in the Server Component that received the row.
 */
export function toCalendarDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
