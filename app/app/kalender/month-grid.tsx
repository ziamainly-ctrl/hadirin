import Link from 'next/link';
import { StatusDot } from '@/components/shared/StatusBadge';
import { WEEKDAY_SHORT, formatLongDate } from '@/lib/insights/calendar-grid';
import type { GridDay } from '@/lib/insights/calendar-grid';
import type { DayCounts } from '@/lib/insights/statistics';
import { calendarHref } from './calendar-url';
import CountChips from './count-chips';
import type { HolidayEntry } from './holiday-types';

export interface MonthGridProps {
  weeks: GridDay[][];
  month: string;
  today: string;
  counts: Map<string, DayCounts>;
  holidays: Map<string, HolidayEntry[]>;
  branchId?: number;
  className?: string;
}

function describeDay(date: string, counts: DayCounts | undefined, holidays: HolidayEntry[] | undefined): string {
  const parts = [formatLongDate(date)];
  if (counts) {
    const bits = [
      counts.present > 0 ? `${counts.present} hadir` : null,
      counts.late > 0 ? `${counts.late} terlambat` : null,
      counts.absent > 0 ? `${counts.absent} tidak hadir` : null,
      counts.away > 0 ? `${counts.away} cuti, sakit, atau izin` : null,
    ].filter((b): b is string => b !== null);
    if (bits.length > 0) parts.push(bits.join(', '));
  }
  if (holidays && holidays.length > 0) parts.push(`Libur: ${holidays.map((h) => h.name).join(', ')}`);
  return parts.join('. ');
}

/**
 * Month grid, Monday first, from md up. The card fills the height Page.Body has left on desktop
 * (the rows share it equally), so a 6-row month and a 4-row month both fit one viewport; below lg
 * the rows keep a minimum height and the page scrolls normally. Each in-month day is a link to
 * `?day=`, which the page turns into the day dialog on the server.
 */
export default function MonthGrid({ weeks, month, today, counts, holidays, branchId, className }: MonthGridProps) {
  return (
    <div className={`min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface ${className ?? ''}`}>
      <div aria-hidden="true" className="grid shrink-0 grid-cols-7 bg-accent text-xs font-medium uppercase tracking-wide text-muted shadow-[inset_0_-1px_0_var(--color-border)]">
        {/* No dimmed weekend headers: opacity-70 on text-muted measured 2.96:1 (axe color-contrast, AA is 4.5). */}
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} className="px-2 py-2">
            {label}
          </div>
        ))}
      </div>
      <ol
        // --cal-row: the least height of a week row. Roomy where the page scrolls (below lg); tight from lg,
        // where the rows share one viewport and 1024x600 still has to show six weeks.
        className="grid min-h-0 flex-1 grid-cols-7 [--cal-row:5.5rem] lg:[--cal-row:3.25rem]"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(var(--cal-row), 1fr))` }}
        aria-label="Kalender kehadiran bulanan"
      >
        {weeks.flat().map((cell, index) => {
          const isLastRow = Math.floor(index / 7) === weeks.length - 1;
          const isLastCol = index % 7 === 6;
          const frame = `${isLastRow ? '' : 'border-b'} ${isLastCol ? '' : 'border-r'} border-border`;
          if (!cell.inMonth) {
            return (
              <li key={cell.date} aria-hidden="true" className={`min-w-0 p-2 text-xs text-muted/40 ${frame}`}>
                {cell.day}
              </li>
            );
          }
          const dayCounts = counts.get(cell.date);
          const dayHolidays = holidays.get(cell.date);
          const isToday = cell.date === today;
          const isWeekend = cell.weekday >= 6;
          return (
            <li key={cell.date} className={`@container min-h-0 min-w-0 ${frame}`}>
              <Link
                href={calendarHref({ month, branchId, day: cell.date })}
                prefetch={false}
                scroll={false}
                aria-label={describeDay(cell.date, dayCounts, dayHolidays)}
                aria-current={isToday ? 'date' : undefined}
                className="flex h-full min-w-0 flex-col gap-0.5 overflow-hidden p-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50 @min-[6rem]:p-2"
              >
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center self-start rounded-full px-1 text-xs font-semibold tabular-nums ${
                    isToday ? 'bg-primary text-primary-fg' : isWeekend ? 'text-muted' : 'text-text'
                  }`}
                >
                  {cell.day}
                </span>
                {dayHolidays && dayHolidays.length > 0 ? (
                  <span className="flex min-w-0 items-center gap-1 text-[11px] leading-tight text-muted">
                    <StatusDot status="HOLIDAY" className="h-1.5 w-1.5" />
                    <span className="truncate">
                      {dayHolidays[0]!.name}
                      {dayHolidays.length > 1 ? ` +${dayHolidays.length - 1}` : ''}
                    </span>
                  </span>
                ) : null}
                <CountChips counts={dayCounts} className="mt-1" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
