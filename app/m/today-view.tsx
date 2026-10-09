import { BadgeAlert, CalendarOff, CalendarX2, FileEdit, PartyPopper } from 'lucide-react';
import Card from '@/components/ui/Card';
import ButtonLink from '@/components/ui/ButtonLink';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import StatusBadge from '@/components/shared/StatusBadge';
import WeekStrip from '@/components/shared/WeekStrip';
import CheckInSetup from '@/components/shared/CheckInSetup';
import { requireSession } from '@/lib/auth';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { listShifts } from '@/lib/queries/shifts';
import { listHistoryForUser } from '@/lib/queries/attendance';
import { loadPunchContext } from '@/lib/punch-context';
import { deriveTodayState } from '@/lib/today-state';
import { buildWeek, toTodayLogView } from '@/lib/today-view-model';
import { workDaysSetFromString } from '@/lib/constants/statuses';
import type { AttendanceStatus } from '@/lib/constants/statuses';
import CheckInCard from './check-in-card';
import Notice from './notice';
import { calendarDateToUtc, formatScheduleTime, todayInZone } from './format';

/** Where the screen is mounted: the phone shell (/m), the public site (/check-in) or the admin
 * shell (/app/check-in). The same view; only a few links and the viewfinder sizing differ. */
export type TodayHost = 'm' | 'check-in' | 'app';

// A request approval (LEAVE/SICK/PERMIT) or the close-day/holiday cron (ABSENT/HOLIDAY/OFF)
// can create today's row with no check-in time at all and a status that isn't PRESENT/LATE —
// there is nothing for the camera flow to do then, so the page shows this instead of ever
// mounting CheckInCard (which would otherwise read "no check-in yet" as pending check-in).
const NON_PUNCH_LABELS: Partial<Record<AttendanceStatus, string>> = {
  ABSENT: 'Anda tercatat tidak hadir hari ini.',
  LEAVE: 'Anda sedang cuti hari ini.',
  SICK: 'Anda sedang sakit hari ini.',
  PERMIT: 'Anda sedang izin hari ini.',
  HOLIDAY: 'Hari ini adalah hari libur.',
  OFF: 'Hari ini bukan hari kerja Anda.',
};

const DAY_NAMES = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function describeWorkDays(workDays: string | number): string {
  const days = [...workDaysSetFromString(String(workDays ?? ''))].sort((a, b) => a - b);
  if (days.join(',') === '1,2,3,4,5') return 'Sen–Jum';
  return days.map((d) => DAY_NAMES[d]).join(', ');
}

const LONG_DATE = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Viewfinder sizing per host (see components/shared/SelfieCamera): `--today-chrome` is the height the
// host uses around the viewfinder in the narrow column. The pre-check panel sits above the camera,
// so the phone column reserves 5rem more than before and lets the viewfinder shrink to 9rem on a 360x740 phone, which keeps "Ambil Foto" above the tab bar. /check-in and /app/check-in set the wide
// variables themselves, where the Page frame is one viewport tall.
const HOST_CLASSES: Record<TodayHost, string> = {
  m: '[--today-chrome:38rem] max-lg:[--vf-min:9rem]',
  'check-in': '[--today-chrome:37rem] max-lg:[--vf-min:9rem]',
  app: '[--today-chrome:32rem] max-lg:[--vf-min:9rem]',
};

// Server Component — the "today" check-in screen, rendered by /m (employee shell), by the
// public-site /check-in page (marketing shell) and by /app/check-in (admin shell).
// (TRD.md §4 folder map; PRD.md E2/E3/E4). Mirrors GET /api/me's own composition directly instead of
// fetching it over HTTP (TRD.md §5: Server Components call lib/queries/* functions, never their own
// /api/* route); lib/punch-context.ts is the one loader shared with the punch routes, so the page
// and the API cannot disagree about what the next action is.
export default async function TodayView({ className, host = 'm' }: { className?: string; host?: TodayHost } = {}) {
  const { userId, orgId, role, context } = await requireSession();

  const [user, pc, history] = await Promise.all([
    getUserByIdInOrg(orgId, userId),
    loadPunchContext({ orgId, userId, shiftId: context.shiftId }),
    listHistoryForUser(orgId, userId, 8),
  ]);
  const { org } = pc;

  // The checklist needs the active shifts to offer; nobody else does.
  const needsSetup = !pc.shift || pc.activeBranches.length === 0;
  const shifts = needsSetup ? await listShifts(orgId, { activeOnly: true }) : [];

  // Today's date on the org's wall clock, so "Hari ini" says which day it is.
  const todayLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: org.timezone,
  }).format(new Date());
  const today = todayInZone(org.timezone);

  const action = pc.target?.action ?? null;
  const staleOpenLogDate = pc.staleOpenLog?.workDate ?? null;

  const { state, banners } = deriveTodayState({
    role,
    orgStatus: org.status,
    shiftId: context.shiftId,
    shiftResolved: pc.shift !== null,
    activeBranchCount: pc.activeBranches.length,
    activeShiftCount: shifts.length,
    action,
    todayStatus: pc.todayLog?.status ?? null,
    dayKind: pc.dayKind,
    holidayName: pc.holidayName,
    staleOpenLogDate,
  });

  // The frame (Page) is also the @container the check-in card measures: in the /m phone column it is
  // narrow and the card stacks; in the wide shells it is >= 36rem and the card lays out in two
  // columns. max-w-3xl keeps the wide version from stretching across a 2200px monitor. `className`
  // is for a host that wants to position the frame itself (the marketing page centers it vertically).
  const frame = (body: React.ReactNode) => (
    <Page className={`@container mx-auto w-full max-w-3xl ${HOST_CLASSES[host]} ${className ?? ''}`}>
      <Page.Header title="Hari ini" description={`${todayLabel} · Halo, ${user.name}`} />
      <Page.Body>
        {banners.pastDue ? (
          <Notice
            tone="warning"
            icon={BadgeAlert}
            title="Langganan Anda jatuh tempo"
            role="status"
            action={
              <ButtonLink href="/app/settings/billing" variant="outline" size="sm">
                Buka Tagihan
              </ButtonLink>
            }
          >
            Bayar tagihan sebelum masa tenggang habis agar absen karyawan tidak dihentikan.
          </Notice>
        ) : null}
        {banners.yesterdayOpen ? (
          <Notice
            tone="warning"
            icon={CalendarX2}
            title="Absen keluar kemarin belum tercatat"
            role="status"
            action={
              <ButtonLink
                href={`/m/requests/new?type=CORRECTION&date=${banners.yesterdayOpen.date}`}
                variant="outline"
                size="sm"
              >
                <FileEdit className="h-4 w-4" aria-hidden="true" />
                Ajukan Koreksi
              </ButtonLink>
            }
          >
            {LONG_DATE.format(calendarDateToUtc(banners.yesterdayOpen.date))} Anda belum absen keluar. Ajukan koreksi agar jam keluar tercatat.
          </Notice>
        ) : null}
        {body}
      </Page.Body>
    </Page>
  );

  if (state.kind === 'SUSPENDED') {
    return frame(
      <Card shadow>
        <EmptyState
          icon={CalendarOff}
          message={
            state.canBill
              ? 'Langganan organisasi Anda ditangguhkan, jadi absen dinonaktifkan. Selesaikan pembayaran untuk mengaktifkannya kembali.'
              : 'Langganan organisasi Anda ditangguhkan, jadi absen dinonaktifkan. Hubungi pemilik organisasi.'
          }
          action={
            state.canBill ? (
              <ButtonLink href="/app/settings/billing" variant="outline">
                Buka Tagihan
              </ButtonLink>
            ) : undefined
          }
        />
      </Card>,
    );
  }

  // AGENTS.md domain rule #9: only tracked users (shift_id IS NOT NULL) clock in. An OWNER/ADMIN gets
  // the "Siapkan check-in" checklist (branch, shift, schedule themselves); anyone else is told to ask.
  if (state.kind === 'SETUP' || state.kind === 'NO_BRANCH') {
    const canSetup = state.kind === 'SETUP' ? state.canSetup : state.canManage;
    return frame(
      <Card shadow>
        <CheckInSetup
          userId={userId}
          canSetup={canSetup}
          branches={pc.activeBranches.map((b) => ({ id: b.id, name: b.name, radiusM: b.radiusM }))}
          shifts={shifts.map((s) => ({ id: s.id, name: s.name, timeIn: s.timeIn, timeOut: s.timeOut, workDays: s.workDays }))}
          currentShiftId={pc.shift ? pc.shift.id : null}
          currentBranchId={user.branchId !== null && pc.activeBranches.some((b) => b.id === user.branchId) ? user.branchId : null}
          insideAdmin={host === 'app'}
          untracked={state.kind === 'SETUP'}
        />
      </Card>,
    );
  }

  const shift = pc.shift!; // SETUP above covers the no-shift case.
  const scheduleLabel = `${formatScheduleTime(shift.timeIn)}–${formatScheduleTime(shift.timeOut)}`;
  const week = buildWeek(today, history);

  if (state.kind === 'RECORDED') {
    const label = NON_PUNCH_LABELS[state.status] ?? 'Hari ini sudah tercatat.';
    return frame(
      <Card shadow>
        <Card.Body className="grid gap-5 @xl:grid-cols-2 @xl:gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text">{label}</p>
              <StatusBadge status={state.status} />
            </div>
            <p className="text-xs text-muted">Anda tidak perlu absen masuk atau keluar hari ini.</p>
          </div>
          <section aria-label="Tujuh hari terakhir" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text">7 hari terakhir</h3>
            <WeekStrip days={week} today={today} legend={false} compact />
          </section>
        </Card.Body>
      </Card>,
    );
  }

  // state.kind === 'PUNCH'
  const logView = pc.target?.log ? toTodayLogView(pc.target.log, pc.allBranches, shift, org.timezone) : null;
  const correctionDate = logView?.workDate ?? pc.workDate ?? today;
  const dayNote =
    state.dayKind === 'HOLIDAY'
      ? `Hari ini libur: ${state.holidayName}. Absen tetap dicatat tanpa hitungan terlambat.`
      : state.dayKind === 'OFF'
        ? `Hari ini di luar hari kerja shift Anda (${describeWorkDays(shift.workDays)}). Absen tetap dicatat tanpa hitungan terlambat.`
        : null;

  return frame(
    <>
      {dayNote ? (
        // One line, no heading: this appears every weekend and holiday, and the desktop screen is one viewport tall.
        <Notice tone="info" icon={state.dayKind === 'HOLIDAY' ? PartyPopper : CalendarOff} title={dayNote} role="status" />
      ) : null}
      <Card shadow>
        <Card.Header className="border-b border-border pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-text">{shift.name}</h2>
            <p className="text-xs tabular-nums text-muted">
              Jadwal {scheduleLabel} · {describeWorkDays(shift.workDays)}
            </p>
          </div>
          {logView ? <StatusBadge status={logView.status} /> : null}
        </Card.Header>
        <Card.Body className="pt-1">
          <CheckInCard
            log={logView}
            pendingAction={state.action}
            orgTimezone={org.timezone}
            selfieRequired={org.selfieRequired}
            dayKind={state.dayKind}
            scheduleLabel={scheduleLabel}
            week={week}
            today={today}
            correctionHref={`/m/requests/new?type=CORRECTION&date=${correctionDate}`}
          />
        </Card.Body>
      </Card>
    </>,
  );
}
