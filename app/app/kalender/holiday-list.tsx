import { CalendarDays } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import FitPager from '@/components/shared/FitPager';
import { StatusDot } from '@/components/shared/StatusBadge';
import { WEEKDAY_SHORT, formatMonthLabel, formatShortDate, isoWeekday } from '@/lib/insights/calendar-grid';
import HolidayDeleteButton from './holiday-delete-button';
import { holidayKindLabel } from './holiday-types';
import type { HolidayEntry } from './holiday-types';

export interface HolidayListProps {
  month: string;
  holidays: HolidayEntry[];
  canManage: boolean;
  className?: string;
}

/** The month's holidays in one list: national first-class citizens, company ones deletable by OWNER/ADMIN. */
export default function HolidayList({ month, holidays, canManage, className }: HolidayListProps) {
  return (
    <Card className={`flex min-h-0 flex-col ${className ?? ''}`}>
      <Card.Header className="shrink-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          <CalendarDays className="h-4 w-4 text-muted" aria-hidden="true" />
          Hari libur {formatMonthLabel(month)}
        </h2>
      </Card.Header>
      {holidays.length === 0 ? (
        <p className="text-sm text-muted">
          Tidak ada hari libur bulan ini.
          {canManage ? ' Tambahkan libur perusahaan dengan tombol Tambah Libur.' : ''}
        </p>
      ) : (
        // Desktop: paginated to the height of the card (a month rarely has more than a few holidays,
        // but a company can add any number); the footer runs edge to edge across the card's padding.
        <FitPager
          as="ul"
          label="Daftar hari libur"
          noun="libur"
          className="divide-y divide-border"
          frameClassName="min-h-0 flex-1"
          footerClassName="-mx-4 -mb-4 mt-2"
        >
          {holidays.map((holiday) => (
            <li key={`${holiday.scope}-${holiday.id}`} className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-text">
                  <StatusDot status="HOLIDAY" className="h-2 w-2" />
                  <span className="tabular-nums">
                    {WEEKDAY_SHORT[isoWeekday(holiday.date) - 1]}, {formatShortDate(holiday.date)}
                  </span>
                </p>
                <p className="mt-0.5 break-words text-sm text-text">{holiday.name}</p>
                <Badge dot={false} className="mt-1 border border-border bg-accent text-muted">
                  {holidayKindLabel(holiday)}
                </Badge>
              </div>
              {canManage && holiday.scope === 'COMPANY' ? (
                <HolidayDeleteButton holidayId={holiday.id} holidayName={holiday.name} compact />
              ) : null}
            </li>
          ))}
        </FitPager>
      )}
    </Card>
  );
}
