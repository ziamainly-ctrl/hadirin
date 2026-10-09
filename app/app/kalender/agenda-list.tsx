import Link from 'next/link';
import { StatusDot } from '@/components/shared/StatusBadge';
import { WEEKDAY_SHORT, formatShortDate, isoWeekday, listMonthDates } from '@/lib/insights/calendar-grid';
import type { DayCounts } from '@/lib/insights/statistics';
import { calendarHref } from './calendar-url';
import CountChips from './count-chips';
import type { HolidayEntry } from './holiday-types';

export interface AgendaListProps {
  month: string;
  today: string;
  counts: Map<string, DayCounts>;
  holidays: Map<string, HolidayEntry[]>;
  branchId?: number;
  className?: string;
}

/**
 * Phones (below md): the month as an agenda. Only days with something to say are listed (a recorded
 * attendance count, a holiday, or today); the other days of a 31-day month would be 20 empty rows
 * on a 360px screen. Each row opens the same day dialog as a grid cell.
 */
export default function AgendaList({ month, today, counts, holidays, branchId, className }: AgendaListProps) {
  const dates = listMonthDates(month).filter((d) => counts.has(d) || holidays.has(d) || d === today);
  if (dates.length === 0) {
    return (
      <p className={`rounded-card border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted ${className ?? ''}`}>
        Belum ada catatan kehadiran atau hari libur bulan ini. Pilih bulan lain di atas.
      </p>
    );
  }
  return (
    <ul className={`divide-y divide-border rounded-card border border-border bg-surface ${className ?? ''}`} aria-label="Agenda bulan ini">
      {dates.map((date) => {
        const dayHolidays = holidays.get(date);
        const isToday = date === today;
        return (
          <li key={date}>
            <Link
              href={calendarHref({ month, branchId, day: date })}
              prefetch={false}
              scroll={false}
              className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium text-text">
                  {WEEKDAY_SHORT[isoWeekday(date) - 1]}, {formatShortDate(date)}
                  {isToday ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-fg">Hari ini</span> : null}
                </span>
                {dayHolidays && dayHolidays.length > 0 ? (
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <StatusDot status="HOLIDAY" className="h-1.5 w-1.5" />
                    <span className="break-words">{dayHolidays.map((h) => h.name).join(', ')}</span>
                  </span>
                ) : null}
              </span>
              <CountChips counts={counts.get(date)} showAway className="shrink-0 justify-end gap-x-3" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
