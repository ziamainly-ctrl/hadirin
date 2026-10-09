import { describe, expect, it } from 'vitest';
import { MANAGER_ITEMS, OWNER_ADMIN_ITEMS, navItemsForRole } from '@/lib/constants/admin-nav';
import { groupBySection } from '@/lib/group-by-section';
import { resolveActiveHref } from '@/lib/nav-active';

const EXPECTED_ORDER = [
  '/app',
  '/app/live',
  '/app/check-in',
  '/app/attendance',
  '/app/terlambat',
  '/app/luar-area',
  '/app/selfie',
  '/app/kalender',
  '/app/requests',
  '/app/reports',
  '/app/statistik',
  '/app/peringkat',
  '/app/employees',
  '/app/branches',
  '/app/shifts',
  '/app/log-notifikasi',
  '/app/settings',
  '/app/riwayat',
  '/app/akun',
];

describe('admin nav', () => {
  it('gives OWNER/ADMIN exactly the 19 agreed items in the agreed order', () => {
    expect(OWNER_ADMIN_ITEMS.map((i) => i.href)).toEqual(EXPECTED_ORDER);
  });

  it('has unique hrefs and labels', () => {
    const hrefs = OWNER_ADMIN_ITEMS.map((i) => i.href);
    const labels = OWNER_ADMIN_ITEMS.map((i) => i.label);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('puts every href under /app', () => {
    for (const item of OWNER_ADMIN_ITEMS) expect(item.href === '/app' || item.href.startsWith('/app/')).toBe(true);
  });

  it('groups into the seven sections, each contiguous (no heading appears twice)', () => {
    const groups = groupBySection(OWNER_ADMIN_ITEMS);
    expect(groups.map((g) => g.section)).toEqual([
      'Utama',
      'Absensi',
      'Tinjauan',
      'Analitik',
      'Organisasi',
      'Sistem',
      'Akun',
    ]);
    expect(groups.map((g) => g.items.length)).toEqual([3, 5, 1, 3, 3, 2, 2]);
  });

  it('gives a MANAGER 12 items, a subset of the owner list in the same order', () => {
    expect(MANAGER_ITEMS.map((i) => i.href)).toEqual([
      '/app',
      '/app/live',
      '/app/check-in',
      '/app/attendance',
      '/app/terlambat',
      '/app/luar-area',
      '/app/selfie',
      '/app/kalender',
      '/app/requests',
      '/app/peringkat',
      '/app/riwayat',
      '/app/akun',
    ]);
    const ownerHrefs = new Set(OWNER_ADMIN_ITEMS.map((i) => i.href));
    for (const item of MANAGER_ITEMS) expect(ownerHrefs.has(item.href)).toBe(true);
  });

  it('keeps org-wide pages away from a MANAGER (matches ORG_WIDE_ROLES)', () => {
    const hrefs = MANAGER_ITEMS.map((i) => i.href);
    for (const hidden of [
      '/app/reports',
      '/app/statistik',
      '/app/employees',
      '/app/branches',
      '/app/shifts',
      '/app/log-notifikasi',
      '/app/settings',
    ]) {
      expect(hrefs).not.toContain(hidden);
    }
  });

  it('picks the list by role', () => {
    expect(navItemsForRole('OWNER')).toBe(OWNER_ADMIN_ITEMS);
    expect(navItemsForRole('ADMIN')).toBe(OWNER_ADMIN_ITEMS);
    expect(navItemsForRole('MANAGER')).toBe(MANAGER_ITEMS);
    // An EMPLOYEE is redirected before the menu renders; the fallback is the small list.
    expect(navItemsForRole('EMPLOYEE')).toBe(MANAGER_ITEMS);
  });

  it('resolves the longest href as active, so /app/check-in does not light Dashboard', () => {
    const activeFor = (path: string) => resolveActiveHref(OWNER_ADMIN_ITEMS, path);
    expect(activeFor('/app')).toBe('/app');
    expect(activeFor('/app/check-in')).toBe('/app/check-in');
    expect(activeFor('/app/employees/12')).toBe('/app/employees');
    expect(activeFor('/app/settings/billing')).toBe('/app/settings');
    expect(activeFor('/app/live')).toBe('/app/live');
    expect(activeFor('/elsewhere')).toBeNull();
  });

  it('only matches at a path-segment boundary', () => {
    const items = [{ href: '/app/live' }];
    expect(resolveActiveHref(items, '/app/livestream')).toBeNull();
    expect(resolveActiveHref(items, '/app/live/x')).toBe('/app/live');
  });
});
