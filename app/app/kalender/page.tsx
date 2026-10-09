import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { listBranches } from '@/lib/queries/branches';
import { getDailyStatusCounts, listDayLogs } from '@/lib/queries/calendar';
import type { AttendanceScope } from '@/lib/queries/calendar';
import { listHolidays } from '@/lib/queries/holidays';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { idParam } from '@/lib/validators/common';
import { formatClock, todayInZone } from '@/app/m/format';
import ButtonLink from '@/components/ui/ButtonLink';
import Page from '@/components/shared/Page';
import { StatusDot } from '@/components/shared/StatusBadge';
import {
  buildMonthGrid,
  formatLongDate,
  formatMonthLabel,
  isRealDate,
  monthEnd,
  monthOf,
  monthStart,
  parseMonthParam,
  shiftMonth,
} from '@/lib/insights/calendar-grid';
import type { MonthRange } from '@/lib/insights/calendar-grid';
import { statusMix } from '@/lib/insights/statistics';
import type { DayCounts } from '@/lib/insights/statistics';
import { formatMinutes, toCalendarDate } from '../attendance/format';
import AddHolidayDialog from './add-holiday-dialog';
import AgendaList from './agenda-list';
import CalendarFilters from './calendar-filters';
import { calendarHref } from './calendar-url';
import DayDialog from './day-dialog';
import HolidayList from './holiday-list';
import type { DayDialogRow, HolidayEntry } from './holiday-types';
import MonthGrid from './month-grid';

export const metadata: Metadata = { title: 'Kalender' };

// 24 months back, and a full year ahead: the calendar is also where the owner plans next year's
// company holidays (collective leave, an anniversary), so the 1 month the report pickers allow is too short.
const CALENDAR_RANGE: MonthRange = { monthsBack: 24, monthsForward: 12 };

interface CalendarPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Month calendar (OWNER, ADMIN: whole org; MANAGER: direct reports). Server Component: one query
 * for the per-day counts of the month, the holidays of the year, and, only when `?day=` is present,
 * that day's rows for the dialog. Tenant comes from the session; the manager scope is
 * `users.manager_id = session user`, and an OWNER/ADMIN may narrow by home branch.
 * Company holidays are created and deleted through the existing /api/holidays routes (client leaves).
 */
export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  // An EMPLOYEE has no admin shell (the layout already sends them to /m); this keeps the page safe on its own.
  const { orgId, userId, role } = await requireSession();
  if (role === 'EMPLOYEE') redirect('/m');
  const params = await searchParams;
  const isOrgWide = ORG_WIDE_ROLES.includes(role);

  const org = await getOrganizationPlanContext(orgId);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const today = todayInZone(timeZone);
  const currentMonth = monthOf(today);
  const month = parseMonthParam(firstValue(params.month), currentMonth, CALENDAR_RANGE);

  const branchRaw = isOrgWide ? firstValue(params.branchId) : undefined;
  const branchParsed = branchRaw ? idParam.safeParse(branchRaw) : undefined;
  const branchId = branchParsed?.success ? branchParsed.data : undefined;
  const scope: AttendanceScope = isOrgWide ? { branchId } : { managerId: userId };

  const dayRaw = firstValue(params.day);
  const day = dayRaw && isRealDate(dayRaw) && monthOf(dayRaw) === month ? dayRaw : undefined;

  const year = Number(month.slice(0, 4));
  const [counts, holidayRows, branches, dayLogs] = await Promise.all([
    getDailyStatusCounts(orgId, monthStart(month), monthEnd(month), scope),
    listHolidays(orgId, { year }),
    isOrgWide ? listBranches(orgId, { activeOnly: true }) : Promise.resolve([]),
    day ? listDayLogs(orgId, day, scope) : Promise.resolve(null),
  ]);

  const countsByDate = new Map<string, DayCounts>(counts.map((c) => [c.date, c]));
  const holidaysByDate = new Map<string, HolidayEntry[]>();
  const monthHolidays: HolidayEntry[] = [];
  for (const h of holidayRows) {
    const date = toCalendarDate(h.holidayDate);
    if (monthOf(date) !== month) continue;
    const entry: HolidayEntry = {
      id: h.id,
      date,
      name: h.name,
      scope: h.orgId === null ? 'NATIONAL' : 'COMPANY',
      isCollectiveLeave: h.isCollectiveLeave,
    };
    monthHolidays.push(entry);
    holidaysByDate.set(date, [...(holidaysByDate.get(date) ?? []), entry]);
  }

  const totals = statusMix(counts);
  const weeks = buildMonthGrid(month);

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const canPrev = parseMonthParam(prevMonth, currentMonth, CALENDAR_RANGE) === prevMonth;
  const canNext = parseMonthParam(nextMonth, currentMonth, CALENDAR_RANGE) === nextMonth;

  const dayRows: DayDialogRow[] =
    dayLogs?.rows.map((r) => ({
      logId: r.logId,
      name: r.name,
      status: r.status,
      checkIn: formatClock(r.checkInAt, timeZone),
      checkOut: formatClock(r.checkOutAt, timeZone),
      branchName: r.branchName,
      note:
        r.lateMinutes > 0
          ? `Terlambat ${formatMinutes(r.lateMinutes)}`
          : r.earlyLeaveMinutes > 0
            ? `Pulang awal ${formatMinutes(r.earlyLeaveMinutes)}`
            : null,
      isOutside: r.isOutside,
    })) ?? [];

  const canManageHolidays = isOrgWide;

  return (
    <Page>
      <Page.Header
        title="Kalender"
        description={
          isOrgWide
            ? 'Kehadiran per hari beserta hari libur. Pilih tanggal untuk melihat rincian.'
            : 'Kehadiran tim Anda per hari beserta hari libur. Pilih tanggal untuk melihat rincian.'
        }
        actions={canManageHolidays ? <AddHolidayDialog defaultDate={day ?? today} month={month} branchId={branchId} /> : null}
        inlineActions
      />

      <Page.Toolbar className="items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <nav aria-label="Pilih bulan" className="flex items-center gap-1">
            <MonthStep href={canPrev ? calendarHref({ month: prevMonth, branchId }) : null} label="Bulan sebelumnya" icon={ChevronLeft} />
            <h2 className="min-w-36 px-1 text-center text-base font-semibold text-text" aria-live="polite">
              {formatMonthLabel(month)}
            </h2>
            <MonthStep href={canNext ? calendarHref({ month: nextMonth, branchId }) : null} label="Bulan berikutnya" icon={ChevronRight} />
          </nav>
          {month !== currentMonth ? (
            <ButtonLink href={calendarHref({ month: currentMonth, branchId })} variant="ghost" scroll={false}>
              Bulan Ini
            </ButtonLink>
          ) : null}
          {isOrgWide && branches.length > 0 ? (
            <CalendarFilters
              month={month}
              branches={branches.map((b) => ({ id: b.id, name: b.name }))}
              branchId={branchId !== undefined ? String(branchId) : undefined}
            />
          ) : null}
        </div>

        {/* Doubles as the legend: the same dots the cells use, with the words and the month's totals. */}
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-sm" aria-label={`Total ${formatMonthLabel(month)}`}>
          <li className="inline-flex items-center gap-1.5 tabular-nums">
            <StatusDot status="PRESENT" />
            <span className="font-semibold text-text">{totals.present}</span>
            <span className="text-muted">Hadir</span>
          </li>
          <li className="inline-flex items-center gap-1.5 tabular-nums">
            <StatusDot status="LATE" />
            <span className="font-semibold text-text">{totals.late}</span>
            <span className="text-muted">Terlambat</span>
          </li>
          <li className="inline-flex items-center gap-1.5 tabular-nums">
            <StatusDot status="ABSENT" />
            <span className="font-semibold text-text">{totals.absent}</span>
            <span className="text-muted">Tidak hadir</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <StatusDot status="HOLIDAY" />
            <span className="text-muted">Libur</span>
          </li>
        </ul>
      </Page.Toolbar>

      <Page.Body>
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <MonthGrid
              className="hidden md:flex"
              weeks={weeks}
              month={month}
              today={today}
              counts={countsByDate}
              holidays={holidaysByDate}
              branchId={branchId}
            />
            <AgendaList className="md:hidden" month={month} today={today} counts={countsByDate} holidays={holidaysByDate} branchId={branchId} />
          </div>
          {/* Beside the grid from xl; under it below lg; hidden between (the cells and the day
              dialog already carry the holiday names, and the grid needs the width there). */}
          <aside aria-label="Hari libur bulan ini" className="shrink-0 lg:max-xl:hidden xl:flex xl:max-h-full xl:w-72 xl:self-start">
            <HolidayList month={month} holidays={monthHolidays} canManage={canManageHolidays} className="xl:max-h-full xl:w-full" />
          </aside>
        </div>
      </Page.Body>

      {day ? (
        <DayDialog
          key={day}
          date={day}
          title={formatLongDate(day)}
          holidays={holidaysByDate.get(day) ?? []}
          rows={dayRows}
          truncated={dayLogs?.truncated ?? false}
          isToday={day === today}
          isFuture={day > today}
          canManageHolidays={canManageHolidays}
          closeHref={calendarHref({ month, branchId })}
          attendanceHref={`/app/attendance?dateFrom=${day}&dateTo=${day}`}
        />
      ) : null}
    </Page>
  );
}

// The month arrows are 40px squares (the same look as the pager's arrows in ui/Pagination); a month
// outside the allowed window (24 back, 1 forward) shows the arrow dimmed and is not a link.
function MonthStep({ href, label, icon: Icon }: { href: string | null; label: string; icon: LucideIcon }) {
  const box = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-input border pointer-coarse:h-11 pointer-coarse:w-11';
  if (href === null) {
    return (
      <span aria-hidden="true" className={`${box} border-border text-muted/40`}>
        <Icon className="h-4 w-4" />
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className={`${box} border-input bg-surface text-text shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
