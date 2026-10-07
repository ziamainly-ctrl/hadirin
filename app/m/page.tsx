import { CalendarOff } from 'lucide-react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/shared/EmptyState';
import { requireSession } from '@/lib/auth';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getShiftByIdInOrg } from '@/lib/queries/shifts';
import { getLogByUserAndDate } from '@/lib/queries/attendance';
import { computeWorkDate } from '@/lib/attendance-rules';
import CheckInCard, { type PendingAction } from './check-in-card';

/** shifts.time_in/time_out come back as "HH:MM:SS" (or "HH:MM"); display is HH:MM only. */
function formatScheduledTime(time: string): string {
  return time.slice(0, 5);
}

// Server Component — the /m "today" screen (TRD.md §4 folder map; PRD.md E2/E3/E4).
// Mirrors GET /api/me's own composition directly instead of fetching it over HTTP
// (TRD.md §5: Server Components call lib/queries/* functions, never their own
// /api/* route). Uses getShiftByIdInOrg rather than the bare getShiftRuleById
// api/me calls, because this page also needs the shift's name for display — its
// timeOut/isCrossDay columns are the same ones computeWorkDate needs, so the one
// tenant-scoped query covers both the rule computation and the UI.
export default async function TodayPage() {
  const { userId, orgId, context } = await requireSession();

  const [user, org] = await Promise.all([getUserByIdInOrg(orgId, userId), getOrganizationPlanContext(orgId)]);
  if (!org) throw new Error(`Organization ${orgId} missing a plan context`);

  const header = (
    <div>
      <h1 className="text-lg font-bold text-text">Hari ini</h1>
      <p className="text-sm text-muted">Halo, {user.name}</p>
    </div>
  );

  // AGENTS.md domain rule #9: only tracked users (shift_id IS NOT NULL) clock in —
  // an untracked account (e.g. an owner who never clocks in) gets no camera UI at all.
  if (!context.shiftId) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Card shadow>
          <EmptyState
            icon={CalendarOff}
            message="Akun ini tidak memiliki jadwal shift dan tidak perlu melakukan absensi check-in."
          />
        </Card>
      </div>
    );
  }

  const shift = await getShiftByIdInOrg(orgId, context.shiftId);
  const workDate = computeWorkDate(new Date(), org.timezone, shift);
  const today = await getLogByUserAndDate(orgId, userId, workDate);

  const pendingAction: PendingAction = !today?.checkInAt ? 'check-in' : !today.checkOutAt ? 'check-out' : 'done';

  return (
    <div className="flex flex-col gap-4">
      {header}
      <Card shadow>
        <Card.Header>
          <div>
            <h2 className="text-sm font-semibold text-text">{shift.name}</h2>
            <p className="text-xs text-muted">
              {formatScheduledTime(shift.timeIn)}–{formatScheduledTime(shift.timeOut)}
            </p>
          </div>
        </Card.Header>
        <Card.Body>
          <CheckInCard key={pendingAction} log={today} pendingAction={pendingAction} orgTimezone={org.timezone} />
        </Card.Body>
      </Card>
    </div>
  );
}
