import { STATUS_LABELS, StatusDot } from '@/components/shared/StatusBadge';
import type { AttendanceStatus } from '@/lib/constants/statuses';

// Every date below is a pure "YYYY-MM-DD" calendar date turned into a UTC-midnight Date and
// formatted with timeZone 'UTC', so it never shifts to the neighbouring day for a viewer in
// another zone (same technique as the /m history page this strip came from).
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' });

export interface WeekStripDay {
  date: string;
  status: AttendanceStatus | null;
}

export interface WeekStripProps {
  /** Seven days, oldest first. A day with no record is a dashed, empty tile (a gap, not a hidden day). */
  days: readonly WeekStripDay[];
  /** "YYYY-MM-DD" of today: ringed. */
  today: string;
  /** Legend for the statuses that actually appear; off in a tight card. */
  legend?: boolean;
  /** Tile height; the check-in card uses a shorter tile so the whole screen fits one viewport. */
  compact?: boolean;
  className?: string;
}

/**
 * The last seven days as a row of tiles: weekday, a neutral tile whose status is a small dot (colour
 * is only ever an accent), and the day of the month. Shared by "Riwayat" and the check-in screen.
 */
export default function WeekStrip({ days, today, legend = true, compact = false, className }: WeekStripProps) {
  const present = (Object.keys(STATUS_LABELS) as AttendanceStatus[]).filter((status) =>
    days.some((day) => day.status === status),
  );
  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`}>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map(({ date, status }) => {
          const day = new Date(`${date}T00:00:00Z`);
          const label = `${DATE_FORMATTER.format(day)}: ${status ? STATUS_LABELS[status] : 'Tidak ada catatan'}`;
          const isToday = date === today;
          return (
            <li key={date} className="flex flex-col items-center gap-1" title={label} aria-label={label}>
              <span className="text-xs font-medium text-muted">{WEEKDAY_FORMATTER.format(day)}</span>
              <span
                className={`flex w-full items-center justify-center rounded-md border bg-accent ${compact ? 'h-7' : 'h-9'} ${
                  status ? 'border-border' : 'border-dashed border-border'
                } ${isToday ? 'ring-2 ring-ring' : ''}`}
              >
                {status ? <StatusDot status={status} className="h-3 w-3" /> : null}
              </span>
              <span className={`text-xs tabular-nums ${isToday ? 'font-semibold text-text' : 'text-muted'}`}>
                {day.getUTCDate()}
              </span>
            </li>
          );
        })}
      </ol>
      {legend && present.length > 0 ? (
        <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted">
          {present.map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <StatusDot status={status} />
              {STATUS_LABELS[status]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-dashed border-muted" />
            Tidak ada catatan
          </li>
        </ul>
      ) : null}
    </div>
  );
}
