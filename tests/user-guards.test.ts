import { describe, it, expect } from 'vitest';
import { canResetPassword, userChangeViolation } from '../lib/user-guards';

const owner = { id: 1, role: 'OWNER', status: 'ACTIVE' } as const;
const admin = { id: 2, role: 'ADMIN', status: 'ACTIVE' } as const;
const staff = { id: 3, role: 'EMPLOYEE', status: 'ACTIVE' } as const;

describe('userChangeViolation', () => {
  it('lets an ADMIN edit an employee and assign MANAGER or EMPLOYEE', () => {
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: staff, role: 'MANAGER', activeOwners: 1 })).toBeNull();
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: null, role: 'EMPLOYEE', activeOwners: 1 })).toBeNull();
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: staff, status: 'INACTIVE', activeOwners: 1 })).toBeNull();
  });

  it('stops an ADMIN promoting themselves, or anyone, to OWNER', () => {
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: admin, role: 'OWNER', activeOwners: 1 })?.code).toBe('OWNER_ONLY');
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: staff, role: 'OWNER', activeOwners: 1 })?.code).toBe('OWNER_ONLY');
  });

  it('stops an ADMIN creating an OWNER or an ADMIN', () => {
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: null, role: 'OWNER', activeOwners: 1 })?.code).toBe('OWNER_ONLY');
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: null, role: 'ADMIN', activeOwners: 1 })?.code).toBe('ADMIN_GRANT_OWNER_ONLY');
  });

  it('lets an ADMIN re-send an ADMIN row unchanged (the edit form posts the whole record)', () => {
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: admin, role: 'ADMIN', status: 'ACTIVE', activeOwners: 1 })).toBeNull();
  });

  it("stops an ADMIN demoting or deactivating the owner, but not editing the owner's other fields", () => {
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: owner, role: 'EMPLOYEE', activeOwners: 2 })?.code).toBe('OWNER_ONLY');
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: owner, status: 'INACTIVE', activeOwners: 2 })?.code).toBe('OWNER_ONLY');
    expect(userChangeViolation({ actorRole: 'ADMIN', actorId: 2, target: owner, role: 'OWNER', status: 'ACTIVE', activeOwners: 1 })).toBeNull();
  });

  it('lets an OWNER grant OWNER and ADMIN', () => {
    expect(userChangeViolation({ actorRole: 'OWNER', actorId: 1, target: staff, role: 'OWNER', activeOwners: 1 })).toBeNull();
    expect(userChangeViolation({ actorRole: 'OWNER', actorId: 1, target: null, role: 'ADMIN', activeOwners: 1 })).toBeNull();
  });

  it('never lets the last active OWNER be demoted or deactivated, even by themselves', () => {
    expect(userChangeViolation({ actorRole: 'OWNER', actorId: 1, target: owner, role: 'ADMIN', activeOwners: 1 })?.code).toBe('LAST_OWNER');
    expect(userChangeViolation({ actorRole: 'OWNER', actorId: 1, target: owner, status: 'INACTIVE', activeOwners: 1 })?.code).toBe('LAST_OWNER');
  });

  it('allows an owner to step down once another owner is active', () => {
    expect(userChangeViolation({ actorRole: 'OWNER', actorId: 1, target: owner, role: 'ADMIN', activeOwners: 2 })).toBeNull();
  });

  it('does not count a re-sent unchanged owner row as a demotion', () => {
    expect(userChangeViolation({ actorRole: 'OWNER', actorId: 1, target: owner, role: 'OWNER', status: 'ACTIVE', activeOwners: 1 })).toBeNull();
  });
});

describe('canResetPassword', () => {
  it("keeps an ADMIN out of the owner's account but not out of staff accounts", () => {
    expect(canResetPassword('ADMIN', 2, owner)).toBe(false);
    expect(canResetPassword('ADMIN', 2, staff)).toBe(true);
    expect(canResetPassword('ADMIN', 2, admin)).toBe(true);
  });
  it('lets an OWNER reset anyone', () => {
    expect(canResetPassword('OWNER', 1, owner)).toBe(true);
    expect(canResetPassword('OWNER', 1, staff)).toBe(true);
  });
});
