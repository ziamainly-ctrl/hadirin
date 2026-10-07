// Timezone helpers built on Intl only — no date library is in TRD.md §3's fixed
// dependency list. Org timezone defaults to Asia/Jakarta (fixed UTC+7, no DST), so the
// single-pass offset correction below is exact for the app's actual target zone and a
// close, standard approximation for any DST zone.

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** The wall-clock date/time that `instant` shows when displayed in `timeZone`. */
export function getLocalParts(instant: Date, timeZone: string): LocalParts {
  const parts = getFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Intl with hour12:false renders midnight as "24" in some engines; normalize to 0.
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Local wall-clock date/time in `timeZone`, as an exact UTC instant. */
export function zonedTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const shown = getLocalParts(new Date(guessUtcMs), timeZone);
  const shownAsUtcMs = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
  const offsetMs = shownAsUtcMs - guessUtcMs; // (local - UTC) at that instant
  return new Date(guessUtcMs - offsetMs);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` for the given parts. */
export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Parses `YYYY-MM-DD` (or a value coercible to one) into {year, month, day}. */
export function parseDate(value: string): { year: number; month: number; day: number } {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return { year: y!, month: m!, day: d! };
}

/** Adds `days` (may be negative) to a `YYYY-MM-DD` date string, calendar-wise. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const { year, month, day } = parseDate(dateStr);
  const ms = Date.UTC(year, month - 1, day) + days * 86_400_000;
  const d = new Date(ms);
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Parses a Postgres `TIME` string ("HH:MM" or "HH:MM:SS") into seconds since midnight. */
export function timeStringToSeconds(time: string): number {
  const [h = 0, m = 0, s = 0] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}
