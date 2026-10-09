import { describe, it, expect } from 'vitest';
import { deriveTodayState, canManageSetup, type TodayStateInput } from '../lib/today-state';

const base: TodayStateInput = {
  role: 'EMPLOYEE',
  orgStatus: 'ACTIVE',
  shiftId: 1,
  shiftResolved: true,
  activeBranchCount: 1,
  activeShiftCount: 1,
  action: 'check-in',
  todayStatus: null,
  dayKind: 'WORK',
  holidayName: null,
  staleOpenLogDate: null,
};

describe('deriveTodayState precedence: SUSPENDED > SETUP > NO_BRANCH > RECORDED > PUNCH', () => {
  it('a tracked employee with a branch gets the punch screen', () => {
    const { state } = deriveTodayState(base);
    expect(state).toEqual({ kind: 'PUNCH', action: 'check-in', dayKind: 'WORK', holidayName: null });
  });

  it('a suspended organisation wins over everything; only the OWNER is offered billing', () => {
    expect(deriveTodayState({ ...base, orgStatus: 'SUSPENDED', role: 'OWNER', shiftId: null }).state).toEqual({ kind: 'SUSPENDED', canBill: true });
    expect(deriveTodayState({ ...base, orgStatus: 'SUSPENDED', role: 'ADMIN' }).state).toEqual({ kind: 'SUSPENDED', canBill: false });
  });

  it('a new organisation: the untracked OWNER/ADMIN gets the setup checklist, staff get "ask your admin"', () => {
    const owner = deriveTodayState({ ...base, role: 'OWNER', shiftId: null, shiftResolved: false, activeBranchCount: 0, activeShiftCount: 0, action: null });
    expect(owner.state).toEqual({ kind: 'SETUP', canSetup: true, hasActiveBranch: false, hasActiveShift: false });
    const admin = deriveTodayState({ ...base, role: 'ADMIN', shiftId: null, shiftResolved: false, action: null });
    expect(admin.state).toMatchObject({ kind: 'SETUP', canSetup: true });
    for (const role of ['MANAGER', 'EMPLOYEE'] as const) {
      const staff = deriveTodayState({ ...base, role, shiftId: null, shiftResolved: false, action: null });
      expect(staff.state).toMatchObject({ kind: 'SETUP', canSetup: false });
    }
  });

  it('a shift id that does not resolve inside the organisation counts as untracked', () => {
    expect(deriveTodayState({ ...base, shiftId: 99, shiftResolved: false, action: null }).state.kind).toBe('SETUP');
  });

  it('tracked but no active branch: NO_BRANCH, with manage rights only for OWNER/ADMIN', () => {
    expect(deriveTodayState({ ...base, activeBranchCount: 0 }).state).toEqual({ kind: 'NO_BRANCH', canManage: false });
    expect(deriveTodayState({ ...base, activeBranchCount: 0, role: 'OWNER' }).state).toEqual({ kind: 'NO_BRANCH', canManage: true });
  });

  it('a leave/sick/absent row without a check-in is RECORDED, not a punch', () => {
    const { state } = deriveTodayState({ ...base, action: 'recorded', todayStatus: 'SICK' });
    expect(state).toEqual({ kind: 'RECORDED', status: 'SICK' });
  });

  it('carries the action (check-out, done, expired) and the day kind into PUNCH', () => {
    expect(deriveTodayState({ ...base, action: 'check-out' }).state).toMatchObject({ kind: 'PUNCH', action: 'check-out' });
    expect(deriveTodayState({ ...base, action: 'done' }).state).toMatchObject({ kind: 'PUNCH', action: 'done' });
    expect(deriveTodayState({ ...base, action: 'expired' }).state).toMatchObject({ kind: 'PUNCH', action: 'expired' });
    expect(deriveTodayState({ ...base, dayKind: 'HOLIDAY', holidayName: 'Hari Kemerdekaan' }).state).toMatchObject({
      dayKind: 'HOLIDAY',
      holidayName: 'Hari Kemerdekaan',
    });
  });
});

describe('banners', () => {
  it('past-due is shown only to OWNER/ADMIN', () => {
    expect(deriveTodayState({ ...base, orgStatus: 'PAST_DUE', role: 'OWNER' }).banners.pastDue).toBe(true);
    expect(deriveTodayState({ ...base, orgStatus: 'PAST_DUE', role: 'EMPLOYEE' }).banners.pastDue).toBe(false);
  });

  it('yesterday\'s unclosed log is surfaced for a tracked person, not for setup or a suspended org', () => {
    expect(deriveTodayState({ ...base, staleOpenLogDate: '2026-10-06' }).banners.yesterdayOpen).toEqual({ date: '2026-10-06' });
    expect(deriveTodayState({ ...base, staleOpenLogDate: '2026-10-06', orgStatus: 'SUSPENDED' }).banners.yesterdayOpen).toBeNull();
    expect(deriveTodayState({ ...base, staleOpenLogDate: '2026-10-06', shiftId: null, shiftResolved: false, action: null }).banners.yesterdayOpen).toBeNull();
  });

  it('canManageSetup is OWNER and ADMIN only', () => {
    expect(canManageSetup('OWNER')).toBe(true);
    expect(canManageSetup('ADMIN')).toBe(true);
    expect(canManageSetup('MANAGER')).toBe(false);
    expect(canManageSetup('EMPLOYEE')).toBe(false);
  });
});
