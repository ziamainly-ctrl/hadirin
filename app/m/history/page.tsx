import type { Metadata } from 'next';
import { History } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listHistoryForUser } from '@/lib/queries/attendance';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import Card from '@/components/ui/Card';
import StatusBadge, { STATUS_LABELS, StatusDot } from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import type { AttendanceStatus } from '@/lib/constants/statuses';
import { calendarDateToUtc, formatClock, formatDuration, toCalendarDate, todayInZone } from '../format';

export const metadata: Metadata = { title: 'Riwayat Absensi' };

// Every formatter below takes calendarDateToUtc() output, so they are pinned to UTC: a pure
// calendar date must never shift to the previous/next day in some viewer's zone.
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' });

// The longest single shift that still plausibly runs: past this, a missing check-out was forgotten.
const MAX_OPEN_SHIFT_MS = 16 * 3_600_000;

/** Checked in, not out yet, and recently enough that the person may still be at work. Not "the log
 * is dated today": a night shift's log keeps the date it started on, so that test would call
 * someone who is still on shift a person who forgot to check out. */
function isStillOpen(checkInAt: string | null, checkOutAt: string | null): boolean {
  return Boolean(checkInAt && !checkOutAt && Date.now() - new Date(checkInAt).getTime() < MAX_OPEN_SHIFT_MS);
}

/** The 7 calendar dates ending today, oldest first ("YYYY-MM-DD"). */
function lastSevenDates(today: string): string[] {
  const end = calendarDateToUtc(today).getTime();
  return Array.from({ length: 7 }, (_, i) => new Date(end - (6 - i) * 86_400_000).toISOString().slice(0, 10));
}

// Server Component: reads the session directly and calls lib/queries/attendance.ts
// (TRD.md §5) — no self-fetch over /api/*.
export default async function HistoryPage() {
  const { orgId, userId } = await requireSession();
  const [history, org] = await Promise.all([listHistoryForUser(orgId, userId, 30), getOrganizationPlanContext(orgId)]);
  // Clock times and "today" on the org's wall clock, the same zone Hari ini uses, so a log
  // never reads 06.57 on one tab and another time on the next.
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const logs = history.map((log) => ({ ...log, date: toCalendarDate(log.workDate) }));

  // A fixed 7-day calendar (not "the last 7 logs"), so a day with no record shows up as a
  // gap instead of the strip silently shrinking to however many rows exist.
  const today = todayInZone(timeZone);
  const byDate = new Map(logs.map((log) => [log.date, log]));
  const week = lastSevenDates(today).map((date) => ({ date, log: byDate.get(date) }));
  // Legend for the strip's colors: only the statuses that actually appear in it, in the
  // order StatusBadge lists them, so the bars are readable without hovering each day.
  const weekStatuses = (Object.keys(STATUS_LABELS) as AttendanceStatus[]).filter((status) =>
    week.some(({ log }) => log?.status === status),
  );

  return (
    <Page>
      <Page.Header title="Riwayat Absensi" description="Catatan absensi Anda selama 30 hari terakhir." />

      {/* The list is the long part: on desktop it scrolls inside the phone column while the title
          and the tab bar stay put (Page.Body); on a phone the page scrolls as usual. */}
      <Page.Body className="gap-5">
        {logs.length === 0 ? (
          <Card>
            <EmptyState
              icon={History}
              message="Belum ada riwayat absensi. Riwayat akan muncul di sini setelah Anda absen masuk."
            />
          </Card>
        ) : (
          <>
            <section aria-labelledby="week-heading" className="flex flex-col gap-2">
              <h2 id="week-heading" className="text-sm font-semibold text-text">
                7 hari terakhir
              </h2>
              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3">
                <ol className="grid grid-cols-7 gap-1.5">
                  {week.map(({ date, log }) => {
                    const day = calendarDateToUtc(date);
                    const label = `${DATE_FORMATTER.format(day)}: ${log ? STATUS_LABELS[log.status] : 'Tidak ada catatan'}`;
                    const isToday = date === today;
                    return (
                      <li key={date} className="flex flex-col items-center gap-1.5" title={label} aria-label={label}>
                        <span className="text-xs font-medium text-muted">{WEEKDAY_FORMATTER.format(day)}</span>
                        {/* A neutral tile; the status is the dot inside it (color is only ever a
                            small accent here). A day with no record is a dashed, empty tile. */}
                        <span
                          className={`flex h-9 w-full items-center justify-center rounded-md border bg-accent ${
                            log ? 'border-border' : 'border-dashed border-border'
                          } ${isToday ? 'ring-2 ring-ring' : ''}`}
                        >
                          {log ? <StatusDot status={log.status} className="h-3 w-3" /> : null}
                        </span>
                        <span className={`text-xs tabular-nums ${isToday ? 'font-semibold text-text' : 'text-muted'}`}>
                          {day.getUTCDate()}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {weekStatuses.length > 0 ? (
                  <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted">
                    {weekStatuses.map((status) => (
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
            </section>

            <section aria-labelledby="list-heading" className="flex flex-col gap-2">
              <h2 id="list-heading" className="text-sm font-semibold text-text">
                Semua catatan
              </h2>
              <ul className="flex flex-col gap-3">
                {logs.map((log) => {
                  const notes = [
                    log.lateMinutes > 0 ? `Terlambat ${formatDuration(log.lateMinutes)}` : null,
                    log.earlyLeaveMinutes > 0 ? `Pulang lebih awal ${formatDuration(log.earlyLeaveMinutes)}` : null,
                    log.workMinutes !== null ? `Durasi kerja ${formatDuration(log.workMinutes)}` : null,
                  ].filter(Boolean);
                  // Leave, sick, permit, holiday or absent days have no clock times at all; the
                  // badge already says why, so a "— / —" grid would only be noise.
                  const hasTimes = Boolean(log.checkInAt || log.checkOutAt);
                  // A log is still open until check-out, which is not the same as "none".
                  const checkOutPending = isStillOpen(log.checkInAt, log.checkOutAt);
                  return (
                    <li key={log.id}>
                      <Card>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="min-w-0 text-sm font-semibold text-text">
                            {DATE_FORMATTER.format(calendarDateToUtc(log.date))}
                          </h3>
                          <StatusBadge status={log.status} />
                        </div>
                        {hasTimes ? (
                          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div className="flex flex-col gap-0.5">
                              <dt className="text-xs text-muted">Masuk</dt>
                              {log.checkInAt ? (
                                <dd className="font-semibold tabular-nums text-text">{formatClock(log.checkInAt, timeZone)}</dd>
                              ) : (
                                <dd className="text-muted">Tidak tercatat</dd>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <dt className="text-xs text-muted">Keluar</dt>
                              {/* A bare "—" does not say whether the day is still open or the
                                  check-out was forgotten, so both get words (the second one
                                  is what a correction request is for). */}
                              {checkOutPending ? (
                                <dd className="text-muted">Belum absen</dd>
                              ) : !log.checkOutAt ? (
                                <dd className="text-muted">Tidak tercatat</dd>
                              ) : (
                                <dd className="font-semibold tabular-nums text-text">{formatClock(log.checkOutAt, timeZone)}</dd>
                              )}
                            </div>
                          </dl>
                        ) : null}
                        {notes.length > 0 ? <p className="mt-2 text-xs text-muted">{notes.join(' · ')}</p> : null}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </Page.Body>
    </Page>
  );
}
