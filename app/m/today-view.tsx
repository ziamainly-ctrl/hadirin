import { CalendarOff } from 'lucide-react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import StatusBadge from '@/components/shared/StatusBadge';
import { requireSession } from '@/lib/auth';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getShiftByIdInOrg } from '@/lib/queries/shifts';
import { getLogByUserAndDate } from '@/lib/queries/attendance';
import { computeWorkDate } from '@/lib/attendance-rules';
import type { AttendanceStatus } from '@/lib/constants/statuses';
import CheckInCard, { type PendingAction } from './check-in-card';
import { formatScheduleTime } from './format';

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

// Server Component — the "today" check-in screen, rendered by /m (employee shell) and by the
// public-site /check-in page (marketing shell). (TRD.md §4 folder map; PRD.md E2/E3/E4).
// Mirrors GET /api/me's own composition directly instead of fetching it over HTTP
// (TRD.md §5: Server Components call lib/queries/* functions, never their own
// /api/* route). Uses getShiftByIdInOrg rather than the bare getShiftRuleById
// api/me calls, because this page also needs the shift's name for display — its
// timeOut/isCrossDay columns are the same ones computeWorkDate needs, so the one
// tenant-scoped query covers both the rule computation and the UI.
export default async function TodayView({ className }: { className?: string } = {}) {
  const { userId, orgId, context } = await requireSession();

  const [user, org] = await Promise.all([getUserByIdInOrg(orgId, userId), getOrganizationPlanContext(orgId)]);
  if (!org) throw new Error(`Organization ${orgId} missing a plan context`);

  // Today's date on the org's wall clock, so "Hari ini" says which day it is.
  const todayLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: org.timezone,
  }).format(new Date());

  // The frame (Page) is also the @container the check-in card measures: in the /m phone column
  // it is narrow and the card stacks; in the wide marketing shell (/check-in) it is >= 36rem
  // and the card puts the viewfinder beside the clock and the capture button. max-w-3xl keeps
  // the wide version from stretching across a 2200px monitor. `className` is for a host that
  // wants to position the frame itself (the marketing page centers it vertically).
  const frame = (body: React.ReactNode) => (
    <Page className={`@container mx-auto w-full max-w-3xl ${className ?? ''}`}>
      <Page.Header title="Hari ini" description={`${todayLabel} · Halo, ${user.name}`} />
      <Page.Body>{body}</Page.Body>
    </Page>
  );

  // AGENTS.md domain rule #9: only tracked users (shift_id IS NOT NULL) clock in —
  // an untracked account (e.g. an owner who never clocks in) gets no camera UI at all.
  if (!context.shiftId) {
    return frame(
      <Card shadow>
        <EmptyState
          icon={CalendarOff}
          message="Akun Anda tidak memiliki jadwal shift, jadi tidak perlu absen masuk atau keluar."
        />
      </Card>,
    );
  }

  const shift = await getShiftByIdInOrg(orgId, context.shiftId);
  const workDate = computeWorkDate(new Date(), org.timezone, shift);
  const today = await getLogByUserAndDate(orgId, userId, workDate);

  const nonPunchLabel = today && !today.checkInAt ? NON_PUNCH_LABELS[today.status] : undefined;
  if (today && nonPunchLabel) {
    return frame(
      <Card shadow>
        <Card.Body>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text">{nonPunchLabel}</p>
            <StatusBadge status={today.status} />
          </div>
        </Card.Body>
      </Card>,
    );
  }

  const pendingAction: PendingAction = !today?.checkInAt ? 'check-in' : !today.checkOutAt ? 'check-out' : 'done';

  return frame(
    <Card shadow>
      <Card.Header className="border-b border-border pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-text">{shift.name}</h2>
          <p className="text-xs tabular-nums text-muted">
            Jadwal {formatScheduleTime(shift.timeIn)}–{formatScheduleTime(shift.timeOut)}
          </p>
        </div>
        {today ? <StatusBadge status={today.status} /> : null}
      </Card.Header>
      <Card.Body className="pt-1">
        <CheckInCard key={pendingAction} log={today} pendingAction={pendingAction} orgTimezone={org.timezone} />
      </Card.Body>
    </Card>,
  );
}
