// Which screen the "Hari ini" page shows (/m, /check-in and /app/check-in render the same
// view). Pure, so the precedence is unit-tested instead of living in JSX branches.

import type { AttendanceStatus, OrgStatus } from './constants/statuses';
import type { UserRole } from './constants/roles';
import type { DayKind, PunchAction } from './punch';

export type TodayState =
  /** The organisation is suspended (unpaid): no check-in for anyone. */
  | { kind: 'SUSPENDED'; canBill: boolean }
  /** Not tracked yet (no shift), or the shift row is unusable. `canSetup` = OWNER/ADMIN: they get the
   * "Siapkan check-in" checklist, everyone else gets "ask your admin". */
  | { kind: 'SETUP'; canSetup: boolean; hasActiveBranch: boolean; hasActiveShift: boolean }
  /** Tracked, but the organisation has no active branch to check in at. */
  | { kind: 'NO_BRANCH'; canManage: boolean }
  /** Today's row exists without a check-in: leave, sick, permit, absent, holiday. */
  | { kind: 'RECORDED'; status: AttendanceStatus }
  | { kind: 'PUNCH'; action: Exclude<PunchAction, 'recorded'>; dayKind: DayKind; holidayName: string | null };

export interface TodayBanners {
  /** Subscription is past due: OWNER/ADMIN only, they are the ones who can pay. */
  pastDue: boolean;
  /** An earlier day was never closed and can no longer be (the check-out window passed). */
  yesterdayOpen: { date: string } | null;
}

export interface TodayStateInput {
  role: UserRole;
  orgStatus: OrgStatus;
  /** `users.shift_id` of the signed-in user. */
  shiftId: number | null;
  /** The shift row exists in this org (a dangling or cross-tenant id counts as "not tracked"). */
  shiftResolved: boolean;
  activeBranchCount: number;
  activeShiftCount: number;
  /** Result of resolvePunchTarget, null when the person has no usable shift. */
  action: PunchAction | null;
  todayStatus: AttendanceStatus | null;
  dayKind: DayKind;
  holidayName: string | null;
  /** The newest open log that is no longer closeable and is not today's own row. */
  staleOpenLogDate: string | null;
}

const CAN_MANAGE: readonly UserRole[] = ['OWNER', 'ADMIN'];

export function canManageSetup(role: UserRole): boolean {
  return CAN_MANAGE.includes(role);
}

export function deriveTodayState(input: TodayStateInput): { state: TodayState; banners: TodayBanners } {
  const canManage = canManageSetup(input.role);
  const banners: TodayBanners = {
    pastDue: canManage && input.orgStatus === 'PAST_DUE',
    yesterdayOpen: input.staleOpenLogDate ? { date: input.staleOpenLogDate } : null,
  };

  if (input.orgStatus === 'SUSPENDED') {
    return { state: { kind: 'SUSPENDED', canBill: input.role === 'OWNER' }, banners: { ...banners, yesterdayOpen: null } };
  }

  const tracked = input.shiftId !== null && input.shiftResolved;
  if (!tracked) {
    return {
      state: {
        kind: 'SETUP',
        canSetup: canManage,
        hasActiveBranch: input.activeBranchCount > 0,
        hasActiveShift: input.activeShiftCount > 0,
      },
      banners: { ...banners, yesterdayOpen: null },
    };
  }

  if (input.activeBranchCount === 0) {
    return { state: { kind: 'NO_BRANCH', canManage }, banners };
  }

  if (input.action === 'recorded' && input.todayStatus) {
    return { state: { kind: 'RECORDED', status: input.todayStatus }, banners };
  }

  const action = input.action && input.action !== 'recorded' ? input.action : 'check-in';
  return { state: { kind: 'PUNCH', action, dayKind: input.dayKind, holidayName: input.holidayName }, banners };
}
