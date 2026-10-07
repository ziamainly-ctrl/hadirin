// Display helpers shared by the /m pages, so "Hari ini", "Riwayat" and "Pengajuan" write
// dates, clock times and durations the same way (id-ID: "07.58", "7 jam 8 menit").

/**
 * A DATE column (work_date, date_from, date_to) as "YYYY-MM-DD". The type says string, but
 * at runtime the Neon driver hands DATE back as a JS Date at *server-local* midnight, so
 * formatting it in UTC (the old approach) showed the previous day on any server east of UTC
 * (a WIB dev machine showed today's log as "Selasa, 6 Oktober" on Wednesday the 7th). The
 * local calendar parts of that Date are the stored date in every server timezone; a plain
 * "YYYY-MM-DD" string is passed through untouched.
 */
export function toCalendarDate(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" as a UTC-midnight Date, for Intl formatters pinned to timeZone: 'UTC'. */
export function calendarDateToUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Today's calendar date ("YYYY-MM-DD") on the wall clock of `timeZone`. */
export function todayInZone(timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** HH.MM (id-ID clock format) of an instant in `timeZone`; "—" when there is none yet. */
export function formatClock(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { timeZone, hour: '2-digit', minute: '2-digit' });
}

/** A shift's "HH:MM[:SS]" schedule time in the same id-ID "HH.MM" form as formatClock. */
export function formatScheduleTime(time: string): string {
  return time.slice(0, 5).replace(':', '.');
}

/** 428 → "7 jam 8 menit", 45 → "45 menit", 480 → "8 jam". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} menit`;
  return m === 0 ? `${h} jam` : `${h} jam ${m} menit`;
}
